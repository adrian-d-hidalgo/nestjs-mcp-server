// Pulls in the SDK's own `express-serve-static-core` Request augmentation so
// that `req.auth` is typed as `AuthInfo | undefined` across this package,
// instead of re-declaring it here. Type-only: nothing is emitted at runtime.
import type {} from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { Type } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Context available when a client connects and its `McpServer` is populated.
 *
 * A fresh `McpServer` is built per connection, so this context describes the
 * single connection whose capabilities are being registered.
 *
 * Deliberately carries **no** `sessionId`: it exists under SSE at registration
 * time but not under streamable HTTP, where the transport assigns it while
 * handling the `initialize` POST — i.e. after registration has already run.
 * Exposing it would make the same predicate behave differently per transport.
 */
export interface McpRegistrationContext {
  /** The HTTP request that opened this connection. */
  request: Request;

  /**
   * Validated token info, present only if auth middleware (for example the
   * SDK's `requireBearerAuth`) populated `req.auth` before the MCP controller
   * ran. Always guard with optional chaining.
   */
  authInfo?: AuthInfo;
}

/**
 * Decides, once per connection, whether a capability is available to the
 * connecting client.
 *
 * Resolved from the Nest container exactly as a guard is, so it may inject
 * services and may answer asynchronously. Declare it as a class, never as an
 * instance: an instance built at module scope cannot reach the container.
 *
 * Runs **before `initialize` is answered**, so keep it cheap and cache at
 * provider scope (upstream guidance: `docs/serving/http.md` — "connection
 * pools and caches should be created at module scope to keep the factory
 * cheap and side-effect-free").
 *
 * Fails **closed** in every failure mode: a synchronous throw, a rejected
 * promise, a class the container cannot resolve, and a gate declared when no
 * registration context exists all disable the capability and log why.
 *
 * **This is discovery-level defence-in-depth, NOT authorization.**
 * `@UseGuards` is the authorization mechanism: it runs on every invocation,
 * against that invocation's own context. A gate runs once, when the
 * connection is established. Under streamable HTTP its context is a snapshot
 * of the `initialize` POST — every later `tools/call` arrives on a different
 * HTTP request whose `req.auth` this mechanism never sees. Anything that can
 * be revoked, expire, or differ per call must be enforced by a guard.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class AdminOnlyGate implements McpCapabilityGate {
 *   constructor(private readonly permissions: PermissionsService) {}
 *
 *   async isEnabled(context: McpRegistrationContext): Promise<boolean> {
 *     return this.permissions.isAdmin(context.authInfo?.clientId);
 *   }
 * }
 * ```
 */
export interface McpCapabilityGate {
  isEnabled(context: McpRegistrationContext): boolean | Promise<boolean>;
}

/**
 * The `enabled` option accepted by `@Tool`, `@Prompt` and `@Resource`.
 *
 * - absent / `true` — registered and enabled (the default). Costs nothing: no
 *   container lookup and no `await`.
 * - `false` — registered and then disabled, so the SDK answers
 *   `<name> disabled` rather than `<name> not found`.
 * - a {@link McpCapabilityGate} **class** — resolved from the Nest container
 *   once per connection and awaited. See {@link McpCapabilityGate} for the
 *   fail-closed contract and the gate-versus-guard boundary.
 */
export type McpCapabilityToggle = boolean | Type<McpCapabilityGate>;
