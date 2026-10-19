/**
 * AI provider adapter (MASTER_PROMPT §13). Server-side only: keys live in the server environment
 * and are never sent to the app. Every feature that uses AI has a deterministic fallback, so
 * `none` is a fully supported configuration.
 */

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Ask the provider to return a JSON object (supported by Ollama and most OpenAI-compatible APIs). */
  json?: boolean;
}
export interface Completion {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIProvider {
  readonly name: 'none' | 'anthropic' | 'openai-compatible' | 'ollama' | 'fake';
  readonly model: string;
  complete(req: CompletionRequest): Promise<Completion>;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

const estimateTokens = (s: string) => Math.ceil(s.length / 4);

async function postJson<T>(url: string, body: unknown, headers: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  if (!res.ok) {
    // Never include the response body: it can echo request content.
    throw new ProviderError(`AI provider HTTP ${res.status}`, res.status === 429 || res.status >= 500);
  }
  return (await res.json()) as T;
}

export const noneProvider: AIProvider = {
  name: 'none',
  model: 'none',
  complete: async () => {
    throw new ProviderError('AI is not configured', false);
  },
  embed: async () => {
    throw new ProviderError('AI is not configured', false);
  },
};

export function anthropicProvider(apiKey: string, model: string, baseUrl = 'https://api.anthropic.com'): AIProvider {
  const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  return {
    name: 'anthropic',
    model,
    async complete({ system, prompt, maxTokens, temperature = 0.2, signal }) {
      const r = await postJson<{ content: { type: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } }>(
        `${baseUrl}/v1/messages`,
        { model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: prompt }] },
        headers,
        signal,
      );
      const text = r.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
      return { text, inputTokens: r.usage?.input_tokens ?? estimateTokens(system + prompt), outputTokens: r.usage?.output_tokens ?? estimateTokens(text) };
    },
    embed: async () => {
      throw new ProviderError('The Anthropic API has no embeddings endpoint; retrieval uses lexical search', false);
    },
  };
}

/** Any OpenAI-compatible chat API (OpenAI, Azure OpenAI, Groq, Together, vLLM, LM Studio, ...). */
export function openAiCompatibleProvider(baseUrl: string, apiKey: string | undefined, model: string, embedModel?: string): AIProvider {
  const base = baseUrl.replace(/\/$/, '');
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  return {
    name: 'openai-compatible',
    model,
    async complete({ system, prompt, maxTokens, temperature = 0.2, signal, json }) {
      const r = await postJson<{ choices: { message: { content: string | null } }[]; usage?: { prompt_tokens: number; completion_tokens: number } }>(
        `${base}/chat/completions`,
        {
          model,
          max_tokens: maxTokens,
          temperature,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        },
        headers,
        signal,
      );
      const text = r.choices[0]?.message.content ?? '';
      return { text, inputTokens: r.usage?.prompt_tokens ?? estimateTokens(system + prompt), outputTokens: r.usage?.completion_tokens ?? estimateTokens(text) };
    },
    async embed(texts, signal) {
      if (!embedModel) throw new ProviderError('AI_EMBED_MODEL is not set', false);
      const r = await postJson<{ data: { embedding: number[] }[] }>(`${base}/embeddings`, { model: embedModel, input: texts }, headers, signal);
      return r.data.map((d) => d.embedding);
    },
  };
}

/** Local models through Ollama: free to run, needs a capable machine or server. */
export function ollamaProvider(baseUrl: string, model: string, embedModel?: string): AIProvider {
  const base = baseUrl.replace(/\/$/, '');
  return {
    name: 'ollama',
    model,
    async complete({ system, prompt, maxTokens, temperature = 0.2, signal, json }) {
      const r = await postJson<{ message: { content: string }; prompt_eval_count?: number; eval_count?: number }>(
        `${base}/api/chat`,
        {
          model,
          stream: false,
          ...(json ? { format: 'json' } : {}),
          options: { temperature, num_predict: maxTokens },
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        },
        {},
        signal,
      );
      const text = r.message.content;
      return { text, inputTokens: r.prompt_eval_count ?? estimateTokens(system + prompt), outputTokens: r.eval_count ?? estimateTokens(text) };
    },
    async embed(texts, signal) {
      if (!embedModel) throw new ProviderError('AI_EMBED_MODEL is not set', false);
      const r = await postJson<{ embeddings: number[][] }>(`${base}/api/embed`, { model: embedModel, input: texts }, {}, signal);
      return r.embeddings;
    },
  };
}

export interface AiConfig {
  AI_PROVIDER: 'none' | 'anthropic' | 'openai-compatible' | 'ollama';
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  AI_EMBED_MODEL?: string;
}

export function createProvider(c: AiConfig): AIProvider {
  switch (c.AI_PROVIDER) {
    case 'anthropic':
      return anthropicProvider(c.AI_API_KEY!, c.AI_MODEL ?? 'claude-haiku-5-5', c.AI_BASE_URL);
    case 'openai-compatible':
      return openAiCompatibleProvider(c.AI_BASE_URL!, c.AI_API_KEY, c.AI_MODEL!, c.AI_EMBED_MODEL);
    case 'ollama':
      return ollamaProvider(c.AI_BASE_URL ?? 'http://127.0.0.1:11434', c.AI_MODEL ?? 'llama3.2', c.AI_EMBED_MODEL);
    default:
      return noneProvider;
  }
}

/** Extracts the first JSON object from model output (models sometimes wrap it in a code fence). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
