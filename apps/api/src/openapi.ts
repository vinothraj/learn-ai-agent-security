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
    '/v1/admin/audit': { get: { summary: 'Audit log (super-admin)', security: bearer, responses: ok('Entries') } },
  },
};
