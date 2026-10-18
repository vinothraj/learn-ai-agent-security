import { contentPack } from '@laas/content';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { notifyTopic, type PushMessage, type PushTicket } from '../src/push';
import { setup, type TestCtx } from './helpers';

let t: TestCtx;
const sent: PushMessage[][] = [];
let nextTickets: (msgs: PushMessage[]) => PushTicket[] = (msgs) => msgs.map(() => ({ status: 'ok' }));
beforeAll(async () => {
  t = await setup({}, async (msgs) => {
    sent.push(msgs);
    return nextTickets(msgs);
  });
});
afterAll(async () => {
  await t.app.close();
  await t.db.close();
});

const token = (s: string) => `ExponentPushToken[${s.padEnd(12, 'x')}]`;
const ok = (msgs: PushMessage[]) => msgs.map((): PushTicket => ({ status: 'ok' }));

async function insertArticle(title: string, highImpact: boolean) {
  const src = (await t.db.query<{ id: string }>('SELECT id FROM news_sources LIMIT 1')).rows[0]!.id;
  const { rows } = await t.db.query<{ id: string }>(
    `INSERT INTO news_articles (source_id, title, url, canonical_url, publisher, category, summary, defense, verification, high_impact, review_status, fingerprint)
     VALUES ($1, $2, $3, $3, 'CISA', 'prompt-injection', 'A summary of the advisory for tests.', 'Patch.', 'source_verified', $4, 'pending', '0') RETURNING id`,
    [src, title, `https://cisa.gov/${encodeURIComponent(title)}`, highImpact],
  );
  return rows[0]!.id;
}

describe('devices and push', () => {
  it('validates and registers tokens, scoped to the signed-in user', async () => {
    const a = await t.login();
    const put = (headers: object | undefined, payload: object) => t.app.inject({ method: 'PUT', url: '/v1/devices', headers: headers as never, payload });
    expect((await put(undefined, { token: token('a'), platform: 'android', topics: [] })).statusCode).toBe(401);
    expect((await put(a.headers, { token: 'not-a-token', platform: 'android', topics: [] })).statusCode).toBe(400);
    expect((await put(a.headers, { token: token('a'), platform: 'android', topics: ['spam'] })).statusCode).toBe(400);
    const res = await put(a.headers, { token: token('a'), platform: 'android', topics: ['advisories', 'advisories'], timezone: 'Asia/Kolkata' });
    expect(res.json()).toEqual({ ok: true, topics: ['advisories'] });

    // Another user cannot delete someone else's token.
    const b = await t.login();
    const del = (headers: object) => t.app.inject({ method: 'DELETE', url: `/v1/devices/${encodeURIComponent(token('a'))}`, headers: headers as never });
    await del(b.headers);
    expect((await t.db.query('SELECT 1 FROM devices WHERE expo_token = $1', [token('a')])).rows).toHaveLength(1);
    await del(a.headers);
    expect((await t.db.query('SELECT 1 FROM devices WHERE expo_token = $1', [token('a')])).rows).toHaveLength(0);
  });

  it('pushes only published high-impact advisories, once per user, and records taps', async () => {
    const admin = await t.login('admin');
    const sub = await t.login();
    const unsub = await t.login();
    await t.app.inject({ method: 'PUT', url: '/v1/devices', headers: sub.headers, payload: { token: token('sub'), platform: 'android', topics: ['advisories'] } });
    await t.app.inject({ method: 'PUT', url: '/v1/devices', headers: unsub.headers, payload: { token: token('unsub'), platform: 'android', topics: ['content'] } });
    sent.length = 0;
    const publish = (id: string) => t.app.inject({ method: 'PATCH', url: `/v1/admin/news/${id}`, headers: admin.headers, payload: { action: 'publish' } });

    await publish(await insertArticle('Low impact', false));
    expect(sent).toHaveLength(0);

    const high = await insertArticle('CVE in agent framework', true);
    await publish(high);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.map((m) => m.to)).toEqual([token('sub')]);
    expect(sent[0]![0]).toMatchObject({ title: 'Security advisory: CVE in agent framework', data: { url: '/news' } });

    // Re-publishing the same article does not notify again.
    await publish(high);
    expect(sent).toHaveLength(1);

    const notificationId = sent[0]![0]!.data.notificationId!;
    expect((await t.app.inject({ method: 'POST', url: `/v1/notifications/${notificationId}/tapped`, headers: unsub.headers })).statusCode).toBe(404);
    expect((await t.app.inject({ method: 'POST', url: `/v1/notifications/${notificationId}/tapped`, headers: sub.headers })).statusCode).toBe(200);
    const row = (await t.db.query<{ status: string; tapped_at: string | null }>('SELECT status, tapped_at FROM notifications WHERE id = $1', [notificationId])).rows[0]!;
    expect(row.status).toBe('sent');
    expect(row.tapped_at).not.toBeNull();
  });

  it('enforces the daily cap and removes unregistered devices', async () => {
    const u = await t.login();
    await t.app.inject({ method: 'PUT', url: '/v1/devices', headers: u.headers, payload: { token: token('cap'), platform: 'android', topics: ['advisories'] } });
    // Isolate this user: subscribers from earlier tests would also be messaged.
    await t.db.query('DELETE FROM devices WHERE expo_token <> $1', [token('cap')]);
    const send = async (msgs: PushMessage[]) => ok(msgs);
    const notice = (ref: string) => ({ topic: 'advisories' as const, type: 'advisory' as const, ref, title: 't', body: 'b', url: '/news' });
    expect(await notifyTopic(t.db, send, notice('1'))).toEqual({ sent: 1, skipped: 0 });
    expect(await notifyTopic(t.db, send, notice('2'))).toEqual({ sent: 1, skipped: 0 });
    expect(await notifyTopic(t.db, send, notice('3'))).toEqual({ sent: 0, skipped: 1 }); // cap: 2 advisories per day

    // Publishing content pushes to "content" subscribers; an unregistered token is removed.
    nextTickets = (msgs) => msgs.map(() => ({ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }));
    await t.app.inject({ method: 'PUT', url: '/v1/devices', headers: u.headers, payload: { token: token('cap'), platform: 'android', topics: ['content'] } });
    const editor = await t.login('editor');
    const admin = await t.login('admin');
    const { id } = (await t.app.inject({ method: 'POST', url: '/v1/admin/content', headers: editor.headers, payload: { label: 'push-test', pack: contentPack } })).json() as { id: string };
    await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/submit`, headers: editor.headers });
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/publish`, headers: admin.headers })).statusCode).toBe(200);
    expect((await t.db.query('SELECT 1 FROM devices WHERE expo_token = $1', [token('cap')])).rows).toHaveLength(0);
    nextTickets = ok;
  });

  it('sends nothing when the push flag is off', async () => {
    await t.db.query(`UPDATE feature_flags SET enabled = false WHERE key = 'push'`);
    const send = async (): Promise<PushTicket[]> => {
      throw new Error('should not send');
    };
    expect(await notifyTopic(t.db, send, { topic: 'advisories', type: 'advisory', ref: 'x', title: 't', body: 'b', url: '/' })).toEqual({ sent: 0, skipped: 0 });
    await t.db.query(`UPDATE feature_flags SET enabled = true WHERE key = 'push'`);
  });
});
