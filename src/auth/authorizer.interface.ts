import type { AuthInfo } from '@modelcontextprotocol/server';

import type { AuthenticatedRequest } from '../interfaces/handler-context.interface';

/**
 * Request-level authorization (Layer 2a), owned by the application.
 *
 * Runs **once per HTTP request**, in the order declared in
 * `McpModuleOptions.auth.authorizers`, after a strategy authenticated the
 * caller and before the MCP SDK sees the request. Each authorizer receives the
 * `AuthInfo` produced so far and returns the one to continue with, so it can:
 *
 * - pass the caller through unchanged;
 * - **narrow** or **enrich** it — for example intersect the key's scopes with
 *   the caller's role in the workspace selected by a header, or attach the
 *   resolved workspace to `extra`;
 * - refuse it: throw `McpAccessDeniedError` for `403 access_denied` (something
 *   re-consent cannot fix, such as not being a member of the workspace), or
 *   `new OAuthError(OAuthErrorCode.InsufficientScope, …)` for a `403`
 *   `insufficient_scope` challenge.
 *
 * The returned `AuthInfo` replaces `req.auth`, so capability gates, the
 * per-capability `scopes` challenge, guards and `ctx.http.authInfo` all see the
 * effective identity.
 *
 * Why this layer exists: the SDK evaluates a capability's scope challenge
 * **before** the library runs guards, and gates run at registration. Anything
 * that changes the caller's effective scopes must therefore be computed before
 * the SDK sees the request — here.
 *
 * Declare authorizers as Nest providers; an unresolvable class stops the
 * application from starting (fail closed).
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class WorkspaceAuthorizer implements McpAuthorizer {
 *   constructor(private readonly members: MembershipService) {}
 *
 *   async authorize(request: AuthenticatedRequest, auth: AuthInfo): Promise<AuthInfo> {
 *     const workspace = request.headers['x-workspace'];
 *     const role = await this.members.roleOf(auth.clientId, workspace);
 *     if (!role) throw new McpAccessDeniedError('Not a member of this workspace');
 *
 *     return {
 *       ...auth,
 *       scopes: auth.scopes.filter((scope) => role.allows(scope)),
 *       extra: { ...auth.extra, workspace },
 *     };
 *   }
 * }
 * ```
 */
export interface McpAuthorizer {
  authorize(
    request: AuthenticatedRequest,
    auth: AuthInfo,
  ): Promise<AuthInfo> | AuthInfo;
}
