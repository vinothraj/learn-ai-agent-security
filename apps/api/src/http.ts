import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { roleRank, type Role } from './auth';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Validates untrusted input with zod; failures become 400s listing the first issues. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new HttpError(
      400,
      'Invalid request',
      r.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return r.data;
}

export interface AuthContext {
  id: string;
  email: string | null;
  role: Role;
  orgId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export function requireAuth(req: FastifyRequest): AuthContext {
  if (!req.auth) throw new HttpError(401, 'Authentication required');
  return req.auth;
}

/** Route-level RBAC guard. Always enforced on the server; the app only hides UI. */
export function requireRole(min: Role) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const auth = requireAuth(req);
    if (roleRank(auth.role) < roleRank(min)) throw new HttpError(403, 'Insufficient role');
  };
}
