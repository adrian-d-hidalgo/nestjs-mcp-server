import type { AuthInfo } from '@modelcontextprotocol/server';

import type { AuthenticatedRequest } from '../interfaces/handler-context.interface';

/**
 * One way of recognizing the caller of the MCP endpoint (Layer 1).
 *
 * The library does not decide *how* to authenticate: the application registers
 * one or more strategies in `McpModuleOptions.auth.strategies` — an API key read
 * from a custom header, an API key sent as a Bearer token, a JWT verified with
 * `jose`, an opaque OAuth token introspected against an authorization server,
 * anything that can be read off the HTTP request. They run **in order, once per
 * HTTP request**, before the MCP handler, and the first one that returns an
 * `AuthInfo` wins.
 *
 * The return value is the SDK's own `AuthInfo` — there is no library identity
 * type. Application-specific identity (user id, workspace, key id) goes in
 * `AuthInfo.extra`. Note `token` and `clientId` are required, and `expiresAt`
 * is in **seconds** since the epoch.
 *
 * The returned value is checked: an `AuthInfo` without a string `token`, a
 * string `clientId` and a `scopes` array of strings (or with a non-numeric
 * `expiresAt`) is a programming error answered `500`, exactly like an
 * authorizer returning a non-`AuthInfo`; one whose `expiresAt` is already in
 * the past is answered `401 invalid_token`.
 *
 * Declare strategies as Nest providers: they are resolved from the container at
 * boot, and a class that cannot be resolved stops the application from
 * starting (fail closed).
 *
 * ## The three outcomes
 *
 * - return an `AuthInfo` — the caller is authenticated; later strategies are
 *   skipped.
 * - return `null` — "no credentials for me": the next strategy runs. When every
 *   strategy returns `null` the request is answered `401` with a
 *   `WWW-Authenticate` challenge (or passes anonymously when
 *   `auth.optional` is `true`).
 * - throw `new OAuthError(OAuthErrorCode.InvalidToken, …)` — "the credentials
 *   are mine but invalid": evaluation stops and the request is answered `401`
 *   with `error="invalid_token"`. Throw an `McpHttpError` to answer with any
 *   other status (for example `429` with `Retry-After`). Anything else thrown is
 *   a `500`.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ApiKeyStrategy implements McpAuthStrategy {
 *   constructor(private readonly keys: ApiKeyService) {}
 *
 *   async authenticate(request: AuthenticatedRequest): Promise<AuthInfo | null> {
 *     const key = request.headers['x-api-key'];
 *     if (typeof key !== 'string') return null;
 *
 *     const record = await this.keys.find(key);
 *     if (!record) {
 *       throw new OAuthError(OAuthErrorCode.InvalidToken, 'Unknown API key');
 *     }
 *
 *     return { token: key, clientId: record.id, scopes: record.scopes };
 *   }
 * }
 * ```
 */
export interface McpAuthStrategy {
  /**
   * The HTTP authentication challenge (RFC 9110 §11.6.1) that tells a client
   * how to present this strategy's credentials, for example
   * `ApiKey header="x-api-key"` or `Basic realm="my-server"`.
   *
   * Every declared challenge is sent in the `WWW-Authenticate` header of a
   * `401`, so a client learns all the methods the server accepts. Leave it
   * undefined for OAuth/Bearer strategies: the library emits the Bearer
   * challenge itself (with `resource_metadata` when `auth.protectedResource`
   * is set).
   *
   * Validated at boot: a value that is not one RFC 9110 challenge (an
   * auth-scheme, optionally followed by a token68 or comma-separated
   * auth-params, with no control characters) stops the application from
   * starting.
   */
  readonly challenge?: string;

  authenticate(
    request: AuthenticatedRequest,
  ): Promise<AuthInfo | null> | AuthInfo | null;
}
