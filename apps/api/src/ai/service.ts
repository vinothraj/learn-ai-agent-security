import { createHash } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { z } from 'zod';
import type { Db } from '../db';
import { extractJson, ProviderError, type AIProvider } from './providers';

export type AiTask = 'tutor' | 'interview_feedback' | 'quiz_generation' | 'news_summary' | 'news_pack';

export interface AiLimits {
  /** Total tokens (input + output) per UTC day across all users. */
  dailyTokenBudget: number;
  /** AI requests per user per UTC day (admin tasks are not counted per user). */
  userDailyRequests: number;
  timeoutMs: number;
}

export type AiOutcome<T> =
  | { ok: true; value: T; cached: boolean }
  | { ok: false; reason: 'disabled' | 'budget' | 'user_limit' | 'timeout' | 'provider_error' | 'invalid_output' };

const CACHE_TTL_DAYS = 7;

/**
 * Runs bounded AI tasks: checks the feature flag, the global daily token budget and the per-user
 * daily limit, serves cached answers, applies a timeout with one retry for transient errors, and
 * validates the output against a schema. Callers always have a deterministic fallback.
 */
export class AiService {
  constructor(
    private readonly db: Db,
    private readonly provider: AIProvider,
    private readonly limits: AiLimits,
    private readonly log?: FastifyBaseLogger,
  ) {}

  get providerName() {
    return this.provider.name;
  }
  get model() {
    return this.provider.model;
  }

  async enabled(): Promise<boolean> {
    if (this.provider.name === 'none') return false;
    const flag = (await this.db.query<{ enabled: boolean }>(`SELECT enabled FROM feature_flags WHERE key = 'ai'`)).rows[0];
    return !!flag?.enabled;
  }

  async usageToday() {
    const r = (
      await this.db.query<{ tokens: string | null; requests: string | null }>(
        `SELECT sum(input_tokens + output_tokens)::text AS tokens, sum(requests)::text AS requests FROM ai_usage WHERE day = current_date`,
      )
    ).rows[0]!;
    return { tokens: Number(r.tokens ?? 0), requests: Number(r.requests ?? 0), budget: this.limits.dailyTokenBudget };
  }

  async run<T>(
    task: AiTask,
    opts: { userId: string | null; system: string; prompt: string; maxTokens: number; schema: z.ZodType<T>; temperature?: number; cache?: boolean },
  ): Promise<AiOutcome<T>> {
    if (!(await this.enabled())) return { ok: false, reason: 'disabled' };
    const key = createHash('sha256').update(`${task}\n${this.provider.name}\n${this.provider.model}\n${opts.system}\n${opts.prompt}`).digest('hex');

    if (opts.cache !== false) {
      const hit = (await this.db.query<{ output: unknown }>(`SELECT output FROM ai_cache WHERE key = $1 AND expires_at > now()`, [key])).rows[0];
      const parsed = hit ? opts.schema.safeParse(hit.output) : null;
      if (parsed?.success) return { ok: true, value: parsed.data, cached: true };
    }

    if ((await this.usageToday()).tokens >= this.limits.dailyTokenBudget) return { ok: false, reason: 'budget' };
    if (opts.userId) {
      const used = (
        await this.db.query<{ n: string | null }>(`SELECT sum(requests)::text AS n FROM ai_usage WHERE day = current_date AND user_id = $1`, [opts.userId])
      ).rows[0]!;
      if (Number(used.n ?? 0) >= this.limits.userDailyRequests) return { ok: false, reason: 'user_limit' };
    }

    let text: string | null = null;
    let reason: 'timeout' | 'provider_error' = 'provider_error';
    for (let attempt = 0; attempt < 2 && text === null; attempt++) {
      try {
        const c = await this.provider.complete({
          system: opts.system,
          prompt: opts.prompt,
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
          signal: AbortSignal.timeout(this.limits.timeoutMs),
          json: true, // every task expects a JSON object
        });
        await this.record(task, opts.userId, c.inputTokens, c.outputTokens);
        text = c.text;
      } catch (e) {
        const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
        reason = timedOut ? 'timeout' : 'provider_error';
        this.log?.warn({ task, provider: this.provider.name, reason, err: e instanceof Error ? e.message : String(e) }, 'AI call failed');
        const retryable = !timedOut && e instanceof ProviderError && e.retryable;
        if (!retryable) break;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (text === null) return { ok: false, reason };

    const parsed = opts.schema.safeParse(extractJson(text));
    if (!parsed.success) {
      // Paths and codes only: model output can contain learner text, so it is never logged.
      const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}:${i.code}`);
      this.log?.warn({ task, provider: this.provider.name, issues }, 'AI output failed schema validation');
      return { ok: false, reason: 'invalid_output' };
    }
    if (opts.cache !== false) {
      await this.db.query(
        `INSERT INTO ai_cache (key, task, output, expires_at) VALUES ($1, $2, $3, now() + make_interval(days => $4))
         ON CONFLICT (key) DO UPDATE SET output = EXCLUDED.output, expires_at = EXCLUDED.expires_at`,
        [key, task, JSON.stringify(parsed.data), CACHE_TTL_DAYS],
      );
    }
    return { ok: true, value: parsed.data, cached: false };
  }

  private async record(task: AiTask, userId: string | null, input: number, output: number) {
    await this.db.query(
      `INSERT INTO ai_usage (day, user_id, task, requests, input_tokens, output_tokens) VALUES (current_date, $1, $2, 1, $3, $4)
       ON CONFLICT (day, user_key, task) DO UPDATE SET requests = ai_usage.requests + 1,
         input_tokens = ai_usage.input_tokens + EXCLUDED.input_tokens, output_tokens = ai_usage.output_tokens + EXCLUDED.output_tokens`,
      [userId, task, input, output],
    );
  }
}
