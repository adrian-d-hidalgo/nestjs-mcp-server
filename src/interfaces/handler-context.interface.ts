import type { AuthInfo, ServerContext } from '@modelcontextprotocol/server';
import type { Request } from 'express';
import type { IncomingHttpHeaders } from 'http';

/**
 * An Express request carrying the `AuthInfo` an auth middleware validated.
 *
 * Declared locally rather than by importing the SDK's global
 * `express-serve-static-core` augmentation. That augmentation ships in
 * `@modelcontextprotocol/express`; importing it here for its side effect would
 * put a second `Request.auth` declaration into any consumer who also installs
 * that package, and any drift between the two `AuthInfo` definitions becomes a
 * TS2717 in *their* build. Nothing about the runtime changes — the SDK reads
 * `req.auth` off the raw object regardless of how it is typed.
 */
export type AuthenticatedRequest = Request & { auth?: AuthInfo };

/**
 * The context handed to every `@Tool`, `@Prompt` and `@Resource` handler as its
 * last argument. Replaces `RequestHandlerExtra`, which the MCP SDK removed in
 * v2.
 *
 * Extends the SDK's own `ServerContext` — `mcpReq` (the request id, method,
 * `_meta` and the 2026-07-28 envelope), `http`, and `sessionId` — with the
 * Express request this call arrived on.
 *
 * ## What changed from 1.x, and why it matters
 *
 * In 1.x, `extra.headers` and the undocumented `extra.body` were read from the
 * request stored in `SessionManager` when the **connection** opened — the
 * `initialize` POST under streamable HTTP, or the `GET /sse` handshake. They
 * described the handshake, never the call. Under the stateless model there is
 * no stored connection: {@link request} is the very HTTP request this
 * invocation arrived on, so an `Authorization` header that expired or changed
 * since the handshake is now seen correctly.
 *
 * ## `sessionId`
 *
 * Inherited from the SDK and **`undefined` on 2026-07-28 traffic** — the spec
 * retired sessions. It may still be populated for 2025-era clients served
 * through the legacy fallback. Never branch on it for authorization; use
 * {@link request} or `http.authInfo`.
 */
export interface McpContext extends ServerContext {
  /** The live Express request this invocation arrived on. */
  readonly request: AuthenticatedRequest;

  /**
   * Shorthand for `request.headers`.
   *
   * Widened from 1.x's `Record<string, string>` to Node's real header type:
   * repeated headers arrive as `string[]`, and absent ones as `undefined`.
   */
  readonly headers: IncomingHttpHeaders;
}
