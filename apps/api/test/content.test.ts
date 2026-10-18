import { contentPack } from '@laas/content';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { csvCell } from '../src/routes/admin';
import { setup, type TestCtx } from './helpers';

let t: TestCtx;
beforeAll(async () => {
  t = await setup();
});
afterAll(async () => {
  await t.app.close();
  await t.db.close();
});

describe('content versions', () => {
  it('runs draft -> submit -> four-eyes publish -> public delivery', async () => {
    const editor = await t.login('editor');
    const admin = await t.login('admin');
    const otherAdmin = await t.login('admin');
    const learner = await t.login('learner');

    // Learners cannot author; editors can.
    expect((await t.app.inject({ method: 'POST', url: '/v1/admin/content', headers: learner.headers, payload: { label: 'x', pack: contentPack } })).statusCode).toBe(403);
    const created = await t.app.inject({ method: 'POST', url: '/v1/admin/content', headers: editor.headers, payload: { label: '2026.10.3', pack: contentPack } });
    expect(created.statusCode).toBe(201);
    const { id, issues } = created.json() as { id: string; issues: string[] };
    expect(issues).toEqual([]);

    // Editors cannot publish; nothing is public yet.
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/publish`, headers: editor.headers })).statusCode).toBe(403);
    expect((await t.app.inject('/v1/content/manifest')).json()).toEqual({ published: null });
    expect((await t.app.inject(`/v1/content/packs/${id}`)).statusCode).toBe(404);

    // Must be in review before publishing.
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/publish`, headers: admin.headers })).statusCode).toBe(409);
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/submit`, headers: editor.headers })).json()).toEqual({ id, status: 'in_review' });
    // In-review versions are frozen.
    expect((await t.app.inject({ method: 'PUT', url: `/v1/admin/content/${id}`, headers: editor.headers, payload: { label: 'changed' } })).statusCode).toBe(409);

    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/publish`, headers: admin.headers, payload: { note: 'Reviewed lessons A-C' } })).json()).toEqual({ id, status: 'published' });

    const manifest = (await t.app.inject('/v1/content/manifest')).json() as { published: { id: string; checksum: string } };
    expect(manifest.published.id).toBe(id);
    const pack = await t.app.inject(`/v1/content/packs/${id}`);
    expect(pack.headers['cache-control']).toContain('immutable');
    expect(pack.json().pack.lessons).toHaveLength(contentPack.lessons.length);

    // A second published version archives the first; the creator cannot publish their own.
    const v2 = (await t.app.inject({ method: 'POST', url: '/v1/admin/content', headers: admin.headers, payload: { label: 'v2', pack: contentPack } })).json() as { id: string };
    await t.app.inject({ method: 'POST', url: `/v1/admin/content/${v2.id}/submit`, headers: admin.headers });
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/content/${v2.id}/publish`, headers: admin.headers })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/content/${v2.id}/publish`, headers: otherAdmin.headers })).statusCode).toBe(200);
    const statuses = (await t.app.inject({ url: '/v1/admin/content', headers: editor.headers })).json().versions.map((v: { label: string; status: string }) => `${v.label}:${v.status}`);
    expect(statuses).toEqual(expect.arrayContaining(['v2:published', '2026.10.3:archived']));
    const audit = await t.db.query(`SELECT action FROM audit_logs WHERE target_type = 'content_version'`);
    expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining(['content.created', 'content.submitted', 'content.published']));
  });

  it('blocks submitting packs that fail validation and lists the problems', async () => {
    const editor = await t.login('editor');
    const broken = structuredClone(contentPack);
    broken.lessons[0]!.prerequisites = ['ghost-lesson'];
    const res = await t.app.inject({ method: 'POST', url: '/v1/admin/content', headers: editor.headers, payload: { label: 'broken', pack: broken } });
    const { id, issues } = res.json() as { id: string; issues: string[] };
    expect(issues.some((i) => i.includes('ghost-lesson'))).toBe(true);
    const submit = await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/submit`, headers: editor.headers });
    expect(submit.statusCode).toBe(422);
    const detail = (await t.app.inject({ url: `/v1/admin/content/${id}`, headers: editor.headers })).json() as { issueList: string[] };
    expect(detail.issueList.length).toBeGreaterThan(0);
    // Fix it in place and submit.
    const fixed = await t.app.inject({ method: 'PUT', url: `/v1/admin/content/${id}`, headers: editor.headers, payload: { pack: contentPack } });
    expect(fixed.json().issues).toEqual([]);
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/submit`, headers: editor.headers })).statusCode).toBe(200);
  });

  it('lets admins reject with a note, after which the draft can be revised', async () => {
    const editor = await t.login('editor');
    const admin = await t.login('admin');
    const { id } = (await t.app.inject({ method: 'POST', url: '/v1/admin/content', headers: editor.headers, payload: { label: 'r1', pack: contentPack } })).json() as { id: string };
    await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/submit`, headers: editor.headers });
    expect((await t.app.inject({ method: 'POST', url: `/v1/admin/content/${id}/reject`, headers: admin.headers, payload: { note: 'Fix lesson B3 wording' } })).json()).toEqual({ id, status: 'rejected' });
    const upd = await t.app.inject({ method: 'PUT', url: `/v1/admin/content/${id}`, headers: editor.headers, payload: { notes: 'Reworded B3' } });
    expect(upd.statusCode).toBe(200);
  });
});

describe('admin utilities', () => {
  it('toggles flags only as super-admin and reflects them in public config', async () => {
    const admin = await t.login('admin');
    const sa = await t.login('super_admin');
    expect((await t.app.inject({ method: 'PATCH', url: '/v1/admin/flags/community', headers: admin.headers, payload: { enabled: true } })).statusCode).toBe(403);
    expect((await t.app.inject({ method: 'PATCH', url: '/v1/admin/flags/community', headers: sa.headers, payload: { enabled: true } })).statusCode).toBe(200);
    expect((await t.app.inject('/v1/config')).json().flags.community).toBe(true);
    expect((await t.app.inject({ method: 'PATCH', url: '/v1/admin/flags/nope', headers: sa.headers, payload: { enabled: true } })).statusCode).toBe(404);
  });

  it('exports users as CSV safely (super-admin only)', async () => {
    const mallory = await t.login('learner');
    await t.app.inject({ method: 'PATCH', url: '/v1/me', headers: mallory.headers, payload: { displayName: '=cmd|calc' } });
    const admin = await t.login('admin');
    const sa = await t.login('super_admin');
    expect((await t.app.inject({ url: '/v1/admin/users/export.csv', headers: admin.headers })).statusCode).toBe(403);
    const res = await t.app.inject({ url: '/v1/admin/users/export.csv', headers: sa.headers });
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain("'=cmd|calc");
    expect(res.body).not.toMatch(/,=cmd/);
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell('+1')).toBe("'+1");
  });

  it('serves a dashboard overview to admins', async () => {
    const admin = await t.login('admin');
    const o = (await t.app.inject({ url: '/v1/admin/overview', headers: admin.headers })).json();
    expect(o).toMatchObject({ users: { total: expect.any(Number) }, news: { pendingReview: 0 }, ingestion: { enabledSources: 7 }, content: { publishedLabel: 'v2' } });
  });
});
