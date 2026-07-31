import type { AuthInfo, ProtocolEra } from '@modelcontextprotocol/server';
import type { Type } from '@nestjs/common';

import type { AuthenticatedRequest } from './handler-context.interface';

/**
 * Context available when an `McpServer` is populated for one request.
 *
 * Under the stateless model a fresh `McpServer` is built **per HTTP request**,
 * so this context describes the single request whose capability set is being
 * assembled — and it is the same request the handler will run on, reachable
 * from a guard as `context.getRequest()`.
 *
 * It carries no `sessionId`: protocol revision 2026-07-28 retired sessions.
 */
export interface McpRegistrationContext {
  /** The HTTP request whose capability set is being assembled. */
  request: AuthenticatedRequest;

  /**
   * Validated token info, present only if auth middleware (for example
   * `requireBearerAuth` from `@modelcontextprotocol/express`) populated
   * `req.auth` before the MCP controller ran. Always guard with optional
   * chaining.
   */
  authInfo?: AuthInfo;

  /**
   * The protocol era this request is being served under — `'modern'` for
   * 2026-07-28 traffic, `'legacy'` for 2025-era clients served through the
   * stateless fallback. Lets a gate expose a different surface per era.
   */
  era: ProtocolEra;
}

/**
 * Decides whether a capability is available to the client making this request.
 *
 * Resolved from the Nest container exactly as a guard is, so it may inject
 * services and may answer asynchronously. Declare it as a class, never as an
 * instance: an instance built at module scope cannot reach the container.
 *
 * ## Cost — read this before writing one
 *
 * A gate is evaluated **once per HTTP request**, on every `tools/list` and
 * every `tools/call`, not once per connection as in 1.x. A gate that queries a
 * database is a per-request database query. Cache at provider scope.
 * Capabilities sharing a gate class cost one `isEnabled` call per request
 * between them, not one each.
 *
 * Fails **closed** in every failure mode: a synchronous throw, a rejected
 * promise, and a class the container cannot resolve all disable the capability
 * and log why.
 *
 * **This is discovery-level defence-in-depth, NOT authorization.** A gate
 * hides a capability from the listing; a guard refuses the invocation. Hiding
 * is not enforcement — a client that already knows the tool name can still
 * call it, and only a guard stops that. Both now see the same request, so a
 * predicate can be factored between them, but the two answer different
 * questions.
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
 *   and awaited, once per request. See {@link McpCapabilityGate} for the
 *   fail-closed contract, the cost, and the gate-versus-guard boundary.
 */
export type McpCapabilityToggle = boolean | Type<McpCapabilityGate>;
