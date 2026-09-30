/**
 * Demo configuration. Real deployments read these from the environment and
 * never ship a hard-coded key or secret.
 */

/**
 * What this example's strategies (`method`, `sub`) and `TenantAuthorizer`
 * (`tenant`) put in `AuthInfo.extra`; read with `getAuthInfo<NotesAuthExtra>`.
 * A type alias, not an interface, so an undeclared key is a compile error.
 */
export type NotesAuthExtra = {
  method?: 'api-key' | 'jwt';
  sub?: string;
  tenant?: string;
};

/** Port the example listens on. */
export const PORT = Number(process.env.PORT ?? 3000);

/** Canonical URL of this MCP endpoint (RFC 8707 audience / RFC 9728 resource). */
export const RESOURCE =
  process.env.MCP_RESOURCE ?? `http://localhost:${PORT}/mcp`;

/** Issuer of the demo JWTs. In production: your authorization server. */
export const ISSUER = process.env.JWT_ISSUER ?? `http://localhost:${PORT}`;

/** Whether `url` points at this machine. */
const isLoopback = (url: string): boolean =>
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);

/**
 * HS256 secret for the demo JWTs. In production: the AS's JWKS.
 *
 * Without `JWT_SECRET` the example falls back to a secret published in this
 * repository — anyone could mint tokens with it — so the fallback is allowed
 * only for a local run: `NODE_ENV` not `production`, and a loopback
 * `MCP_RESOURCE` and `JWT_ISSUER`. Otherwise the example refuses to boot.
 */
const resolveJwtSecret = (): string => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (
    process.env.NODE_ENV === 'production' ||
    !isLoopback(RESOURCE) ||
    !isLoopback(ISSUER)
  ) {
    throw new Error(
      'examples/auth: set JWT_SECRET. The built-in demo secret is public and is only allowed for a local run (NODE_ENV not production, loopback MCP_RESOURCE and JWT_ISSUER).',
    );
  }
  return 'demo-secret-change-me-at-least-32-bytes';
};

export const JWT_SECRET = new TextEncoder().encode(resolveJwtSecret());

/** Demo API keys and the scopes each one grants. */
export const API_KEYS: ReadonlyMap<string, string[]> = new Map([
  ['demo-read-write-key', ['notes:read', 'notes:write']],
  ['demo-read-only-key', ['notes:read']],
]);
