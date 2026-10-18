import { SyncRequest } from '@laas/shared';
import { z } from 'zod';
import { UpdateMe } from './routes/account';

const json = (schema: z.ZodType) => {
  try {
    return z.toJSONSchema(schema, { unrepresentable: 'any' });
  } catch {
    return { type: 'object' };
  }
};

const bearer = [{ bearerAuth: [] }];
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema: json(schema) } } });
const ok = (description: string) => ({ 200: { description } });

/** OpenAPI 3.1 document, generated from the same zod schemas the routes validate with. */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Learn AI & Agent Security API',
    version: '0.1.0',
    description: 'Progress sync, account management and administration. All /v1 routes except /v1/config require a bearer token.',
  },
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/health': { get: { summary: 'Liveness probe', responses: ok('Service is running') } },
    '/ready': { get: { summary: 'Readiness probe (checks the database)', responses: { 200: { description: 'Ready' }, 503: { description: 'Database unavailable' } } } },
    '/v1/config': { get: { summary: 'Public client configuration and feature flags', responses: ok('Config') } },
    '/v1/me': {
      get: { summary: 'Current user profile and role', security: bearer, responses: ok('Profile') },
      patch: { summary: 'Update display name', security: bearer, requestBody: body(UpdateMe), responses: ok('Updated') },
      delete: { summary: 'Delete account and all synced data', security: bearer, responses: ok('Deleted') },
    },
    '/v1/me/export': { get: { summary: 'Export all personal data as JSON', security: bearer, responses: ok('Export file') } },
    '/v1/sync': {
      post: {
        summary: 'Push local changes and pull remote changes since a cursor',
        security: bearer,
        requestBody: body(SyncRequest),
        responses: ok('Merged changes and new cursor'),
      },
    },
    '/v1/admin/stats': { get: { summary: 'Aggregate user counts (admin)', security: bearer, responses: ok('Stats') } },
    '/v1/admin/users': { get: { summary: 'User directory (admin, audit-logged)', security: bearer, responses: ok('Users') } },
    '/v1/admin/users/{id}/role': {
      patch: {
        summary: 'Change a user role (admin; admin roles need super-admin)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: ok('Role changed'),
      },
    },
    '/v1/news': { get: { summary: 'Published security news (public; source excerpt and interpretation are separate fields)', responses: ok('Articles') } },
    '/v1/admin/news': { get: { summary: 'Review queue by status (admin)', security: bearer, responses: ok('Articles') } },
    '/v1/admin/news/{id}': { patch: { summary: 'Publish or reject an article (admin, audit-logged)', security: bearer, responses: ok('Reviewed') } },
    '/v1/admin/news-sources': {
      get: { summary: 'List feed sources (admin)', security: bearer, responses: ok('Sources') },
      post: { summary: 'Add an https feed source with a domain allow-list (admin)', security: bearer, responses: { 201: { description: 'Created' } } },
    },
    '/v1/admin/news-sources/{id}/run': { post: { summary: 'Ingest a source now (admin)', security: bearer, responses: ok('Run summary') } },
    '/v1/admin/ingestion-runs': { get: { summary: 'Recent ingestion runs and failures (admin)', security: bearer, responses: ok('Runs') } },
    '/v1/content/manifest': { get: { summary: 'Currently published content pack (public)', responses: ok('Manifest') } },
    '/v1/content/packs/{id}': { get: { summary: 'Download a published content pack (public, immutable)', responses: ok('Pack') } },
    '/v1/admin/content': {
      get: { summary: 'List content versions (editor+)', security: bearer, responses: ok('Versions') },
      post: { summary: 'Create a draft version from a pack (editor+, validated)', security: bearer, responses: { 201: { description: 'Created' } } },
    },
    '/v1/admin/content/{id}': {
      get: { summary: 'Version with pack and validation issues (editor+)', security: bearer, responses: ok('Version') },
      put: { summary: 'Edit a draft (editor+)', security: bearer, responses: ok('Updated') },
    },
    '/v1/admin/content/{id}/submit': { post: { summary: 'Submit a valid draft for review (editor+)', security: bearer, responses: ok('In review') } },
    '/v1/admin/content/{id}/publish': { post: { summary: 'Publish (admin+, four-eyes)', security: bearer, responses: ok('Published') } },
    '/v1/admin/content/{id}/reject': { post: { summary: 'Reject with a note (admin+)', security: bearer, responses: ok('Rejected') } },
    '/v1/admin/overview': { get: { summary: 'Dashboard aggregates (admin)', security: bearer, responses: ok('Overview') } },
    '/v1/admin/flags': { get: { summary: 'Feature flags (admin)', security: bearer, responses: ok('Flags') } },
    '/v1/admin/flags/{key}': { patch: { summary: 'Toggle a flag (super-admin, audited)', security: bearer, responses: ok('Changed') } },
    '/v1/admin/users/export.csv': { get: { summary: 'User directory CSV (super-admin, audited)', security: bearer, responses: ok('CSV') } },
    '/v1/devices': { put: { summary: 'Register this device for push topics (advisories, content)', security: bearer, responses: ok('Registered') } },
    '/v1/devices/{token}': { delete: { summary: 'Unregister a push token owned by the caller', security: bearer, responses: ok('Removed') } },
    '/v1/notifications/{id}/tapped': { post: { summary: 'Record that a push notification was opened', security: bearer, responses: ok('Recorded') } },
    '/v1/events': { post: { summary: 'Upload opt-in engagement events (idempotent, pseudonymous)', security: bearer, responses: ok('Accepted count') } },
    '/v1/me/analytics': { delete: { summary: 'Withdraw analytics consent and delete shared events', security: bearer, responses: ok('Deleted count') } },
    '/v1/admin/analytics': { get: { summary: 'Engagement metrics per MASTER_PROMPT §16, cohorts under 5 suppressed (admin)', security: bearer, responses: ok('Report') } },
    '/v1/admin/audit': { get: { summary: 'Audit log (super-admin)', security: bearer, responses: ok('Entries') } },
  },
};
