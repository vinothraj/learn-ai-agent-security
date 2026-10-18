import type { FastifyBaseLogger } from 'fastify';
import type { Db } from './db';

/** Expo push message (https://docs.expo.dev/push-notifications/sending-notifications/). */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound?: 'default';
  channelId?: string;
}
export interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}
export type PushSender = (messages: PushMessage[]) => Promise<PushTicket[]>;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

export function expoPushSender(accessToken?: string): PushSender {
  return async (messages) => {
    const tickets: PushTicket[] = [];
    for (let i = 0; i < messages.length; i += BATCH) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(messages.slice(i, i + BATCH)),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);
      tickets.push(...((await res.json()) as { data: PushTicket[] }).data);
    }
    return tickets;
  };
}

export type Topic = 'advisories' | 'content';
export const TOPICS: Topic[] = ['advisories', 'content'];

/** Per-user daily caps so important pushes never become noise. */
const DAILY_CAP: Record<'advisory' | 'content', number> = { advisory: 2, content: 1 };

export interface TopicNotice {
  topic: Topic;
  type: 'advisory' | 'content';
  /** Identifies the event (e.g. article id); combined with the user id for dedupe. */
  ref: string;
  title: string;
  body: string;
  url: string;
}

/**
 * Sends one notice to every device subscribed to a topic. Each user gets it at most once
 * (dedupe key), within a daily cap per type. Tokens Expo reports as unregistered are removed.
 */
export async function notifyTopic(db: Db, send: PushSender | null, notice: TopicNotice, log?: FastifyBaseLogger) {
  if (!send) return { sent: 0, skipped: 0 };
  const flag = (await db.query<{ enabled: boolean }>(`SELECT enabled FROM feature_flags WHERE key = 'push'`)).rows[0];
  if (!flag?.enabled) return { sent: 0, skipped: 0 };
  const devices = (
    await db.query<{ id: string; user_id: string; expo_token: string }>(`SELECT id, user_id, expo_token FROM devices WHERE $1 = ANY(topics)`, [notice.topic])
  ).rows;

  const messages: { msg: PushMessage; notificationId: string; deviceId: string }[] = [];
  let skipped = 0;
  const byUser = new Map<string, typeof devices>();
  for (const d of devices) byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);

  for (const [userId, userDevices] of byUser) {
    const today = (
      await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND type = $2 AND status = 'sent' AND created_at > now() - interval '24 hours'`,
        [userId, notice.type],
      )
    ).rows[0]!.n;
    const capped = today >= DAILY_CAP[notice.type];
    const inserted = (
      await db.query<{ id: string }>(
        `INSERT INTO notifications (user_id, type, dedupe_key, title, body, url, status) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
        [userId, notice.type, `${notice.type}:${notice.ref}:${userId}`, notice.title, notice.body, notice.url, capped ? 'skipped' : 'queued'],
      )
    ).rows[0];
    if (!inserted || capped) {
      skipped++;
      continue;
    }
    for (const d of userDevices) {
      messages.push({
        notificationId: inserted.id,
        deviceId: d.id,
        msg: { to: d.expo_token, title: notice.title, body: notice.body, sound: 'default', channelId: 'advisories', data: { url: notice.url, notificationId: inserted.id } },
      });
    }
  }
  if (!messages.length) return { sent: 0, skipped };

  try {
    const tickets = await send(messages.map((m) => m.msg));
    for (const [i, t] of tickets.entries()) {
      const m = messages[i]!;
      if (t.status === 'ok') {
        await db.query(`UPDATE notifications SET status = 'sent', sent_at = now() WHERE id = $1`, [m.notificationId]);
      } else {
        await db.query(`UPDATE notifications SET status = 'error', error = $2 WHERE id = $1 AND status <> 'sent'`, [m.notificationId, (t.details?.error ?? t.message ?? 'error').slice(0, 200)]);
        if (t.details?.error === 'DeviceNotRegistered') await db.query('DELETE FROM devices WHERE id = $1', [m.deviceId]);
      }
    }
    return { sent: tickets.filter((t) => t.status === 'ok').length, skipped };
  } catch (e) {
    log?.error({ err: e }, 'push send failed');
    for (const m of messages) await db.query(`UPDATE notifications SET status = 'error', error = 'send failed' WHERE id = $1`, [m.notificationId]);
    return { sent: 0, skipped };
  }
}
