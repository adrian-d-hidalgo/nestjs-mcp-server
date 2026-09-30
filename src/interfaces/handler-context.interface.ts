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

  /**
   * Reports progress on this invocation to the client that made it, as a
   * `notifications/progress` correlated with the client's `progressToken`.
   *
   * - **No token, no-op.** Progress is sent only when the request carried
   *   `_meta.progressToken`; otherwise this resolves without sending. Clients
   *   are not obliged to ask for progress, and most do not.
   * - **Modern era under `responseMode: 'json'`** — the SDK drops mid-call
   *   notifications there, so nothing is sent and one warning is logged per
   *   application (per `RegistryService` instance) the first time a handler
   *   reports progress. `'auto'` (the default)
   *   and `'sse'` deliver it; on `'auto'` the first frame turns the response
   *   into an SSE stream.
   * - **Legacy (2025) era** — always delivered over SSE, whatever the
   *   `responseMode`.
   * - **Never rejects.** A progress update that cannot be delivered (the
   *   exchange already ended) is logged at `debug` and dropped, so
   *   fire-and-forget calls are safe.
   * - **Safe to detach.** It never reads `this`, so it can be handed to a
   *   service as a plain callback: `importer.run(rows, ctx.reportProgress)`.
   *
   * `message` reaches the caller verbatim: do not put secrets or other
   * tenants' data in it. Monotonic `progress` values are the caller's
   * responsibility; nothing is validated or throttled.
   *
   * @param progress Progress so far; should increase with every call.
   * @param total The total to reach, when known.
   * @param message A human-readable description of the current step.
   *
   * @example
   * ```typescript
   * for (let i = 1; i <= files.length; i++) {
   *   await analyze(files[i - 1]);
   *   await ctx.reportProgress(i, files.length, `analyzed ${i}/${files.length}`);
   * }
   * ```
   */
  readonly reportProgress: (
    progress: number,
    total?: number,
    message?: string,
  ) => Promise<void>;
}
