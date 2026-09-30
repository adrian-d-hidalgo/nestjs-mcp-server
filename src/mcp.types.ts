import type {
  AuthInfo,
  CreateMcpHandlerOptions,
  Implementation,
  ProtocolOptions,
  ServerCapabilities as SdkServerCapabilities,
  ServerOptions as SdkServerOptions,
  StandardSchemaWithJSON,
} from '@modelcontextprotocol/server';
import { Provider, Type } from '@nestjs/common';

import type { McpAuthStrategy } from './auth/auth-strategy.interface';
import type { McpAuthorizer } from './auth/authorizer.interface';

// Re-exported, not redeclared, so every type appearing in this package's public
// signatures is nameable from `@nestjs-mcp/server`. The SDK is our dependency,
// not the consumer's — under pnpm's strict layout they cannot import it.
export type ServerCapabilities = SdkServerCapabilities;
export type ServerOptions = SdkServerOptions;

/**
 * The effective identity of an MCP request — the SDK's `AuthInfo` with a
 * typed `extra`, for the fields a strategy or an authorizer adds (a tenant,
 * a subject, a role).
 *
 * The type parameter is an assertion about what **your** strategies and
 * authorizers put in `extra`, not a runtime check. With the default it is
 * structurally `AuthInfo`, so the two are interchangeable. `extra` is
 * replaced (`Omit`) rather than intersected: `AuthInfo & { extra?: T }` would
 * keep the SDK's index signature and accept any key on `extra`.
 *
 * @example
 * ```typescript
 * type TenantExtra = { tenant: string }; // a type alias, not an interface
 * const tenant = getAuthInfo<TenantExtra>(ctx)?.extra?.tenant;
 * ```
 */
export type McpAuthInfo<
  TExtra extends Record<string, unknown> = Record<string, unknown>,
> = Omit<AuthInfo, 'extra'> & { extra?: TExtra };

/**
 * The schema type accepted by `paramsSchema` / `argsSchema`.
 *
 * Any Standard Schema implementation that can emit JSON Schema — Zod v4,
 * ArkType, Valibot. Replaces the Zod-raw-shape form used before 2.0: the SDK's
 * `zod-compat` module no longer exists, and its internal `ZodRawShape` is not
 * exported, so a bare shape object is no longer expressible.
 *
 * @example
 * ```typescript
 * // before 2.0
 * paramsSchema: { id: z.string() }
 * // 2.0
 * paramsSchema: z.object({ id: z.string() })
 * ```
 */
export type McpSchema = StandardSchemaWithJSON;

export type McpServerOptions = {
  serverInfo: Implementation;
  options?: ServerOptions;
  logging?: McpLoggingOptions;
};

/**
 * Options for configuring MCP server logging
 */
export type McpLoggingOptions = {
  /**
   * Enable or disable logging
   * @default true
   */
  enabled?: boolean;

  /**
   * Logging verbosity
   * @default 'verbose'
   */
  level?: 'debug' | 'verbose' | 'log' | 'warn' | 'error';
};

/**
 * Options for the stateless MCP HTTP endpoint.
 *
 * Passed through to the SDK's `createMcpHandler`. `Omit` rather than `Pick` so
 * options the SDK adds later arrive without a change here; `onerror` is ours,
 * wired to the Nest logger so handler failures land beside everything else.
 *
 * The option that matters most is `legacy`:
 *
 * - `'stateless'` (default) — 2025-era clients are served per request from the
 *   same factory. `GET` and `DELETE`, which were session operations, answer
 *   `405`. **Every currently published MCP client SDK speaks this era**, so
 *   this is the setting that keeps real clients working.
 * - `'reject'` — modern-only. Rejects 2025-era traffic with the
 *   unsupported-protocol-version error. Verified to break both
 *   `@modelcontextprotocol/sdk@1` and `@modelcontextprotocol/client@2`
 *   clients, so choose it only when you control every caller.
 */
export type McpTransportOptions = Omit<CreateMcpHandlerOptions, 'onerror'>;

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) for the MCP endpoint.
 *
 * When set, the library serves the document at the path
 * `getOAuthProtectedResourceMetadataUrl(resource)` derives (for
 * `https://example.com/mcp`: `/.well-known/oauth-protected-resource/mcp`) and
 * advertises it as `resource_metadata` on the library-built `WWW-Authenticate`
 * challenges (`401` for missing or `invalid_token` credentials, `403`
 * `insufficient_scope`), which is how an OAuth-capable MCP client discovers
 * the authorization server. An `McpAccessDeniedError`, or an
 * `McpUnauthorizedError` carrying its own challenge, is written as thrown.
 *
 * Our own type rather than the SDK's `AuthMetadataOptions`: that one requires
 * the authorization server's full RFC 8414 metadata (`oauthMetadata`) and
 * derives a single issuer from it, while a resource server only needs to name
 * its authorization servers — possibly several — by issuer URL.
 */
export interface McpProtectedResourceOptions {
  /** Canonical URL of the MCP endpoint, e.g. `https://example.com/mcp`. */
  resource: string;
  /** Issuer URL(s) of the authorization server(s) that mint accepted tokens. */
  authorizationServers: string[];
  /**
   * Advertised as `scopes_supported`, and as the `scope` hint on the `401`
   * sent to a request that carried no credentials. Each entry must be an
   * OAuth scope-token (no spaces, quotes, backslashes or control characters);
   * checked at boot.
   */
  scopesSupported?: string[];
  /** Human-readable name, advertised as `resource_name`. */
  resourceName?: string;
}

/**
 * Authentication (Layer 1) and request authorization (Layer 2a) for the MCP
 * endpoint. Absent = every request is served as before.
 *
 * Evaluation order for one HTTP request: `strategies` → `authorizers` → gates
 * (`enabled`, at registration) → the SDK's per-capability `scopes` challenge →
 * guards (`@UseGuards`) → handler.
 */
export interface McpAuthOptions {
  /**
   * Nest providers run in order; the first to return an `AuthInfo` wins. See
   * {@link McpAuthStrategy}. Resolved at boot: an unresolvable class stops the
   * application from starting.
   */
  strategies: Type<McpAuthStrategy>[];
  /**
   * `true` lets a request no strategy recognized through anonymously
   * (`req.auth` is undefined, even if something upstream had set it). Capabilities declaring `scopes` are then
   * disabled for that anonymous request.
   * @default false — such a request is answered `401`.
   */
  optional?: boolean;
  /** Serve RFC 9728 metadata and advertise it on challenges. */
  protectedResource?: McpProtectedResourceOptions;
  /**
   * Nest providers run in order after a successful authentication, once per
   * HTTP request. See {@link McpAuthorizer}.
   */
  authorizers?: Type<McpAuthorizer>[];
  /**
   * What happens to a capability whose `scopes` the caller does not hold:
   *
   * - `false` (default) — it is listed, and invoking it answers `403
   *   insufficient_scope` with the required scopes, so an OAuth client can
   *   step up. Right when the missing scope is one re-consent can grant.
   * - `true` — it is disabled for the request: absent from lists, and a direct
   *   call answers "disabled". Right when the narrowing comes from something
   *   re-consent cannot fix, such as a role in a workspace.
   * @default false
   */
  hideOutOfScope?: boolean;
  /**
   * Decides whether the granted scopes satisfy a capability's `scopes`.
   * @default every required scope is granted
   */
  scopeSatisfies?: (granted: string[], required: string[]) => boolean;
}

/**
 * Options for configuring the global MCP server module
 */
export type McpModuleOptions = {
  /**
   * Additional modules to import
   */
  imports?: Type<any>[];
  /**
   * Providers to register in the module
   * These will be available globally
   */
  providers?: Provider[];
  /**
   * Name of the MCP server
   */
  name: string;
  /**
   * Version of the MCP server
   */
  version: string;
  /**
   * Description to give the AI about the server
   */
  instructions?: string;
  /**
   * Describes the server's purpose or behavior for the AI
   */
  capabilities?: ServerCapabilities;
  /**
   * Protocol-specific options
   */
  protocolOptions?: ProtocolOptions;
  /**
   * Options for configuring MCP server logging
   */
  logging?: McpLoggingOptions;
  /**
   * Options for the stateless MCP HTTP endpoint
   */
  transport?: McpTransportOptions;
  /**
   * The SDK's own `ServerOptions`, passed through verbatim.
   *
   * `Omit` rather than `Pick` so options the SDK adds later arrive without a
   * change here. `instructions` and `capabilities` are omitted because they
   * already have dedicated fields above; anything set here wins over them.
   *
   * This is where the protocol features that are configured server-wide live:
   *
   * - `requestState.verify` — validates the opaque state a multi-round-trip
   *   handler echoes back. **This is what lets an MRTR retry land on a
   *   different instance safely**: without a verify hook the state is
   *   client-supplied and tamperable.
   * - `cacheHints` — `ttlMs` / `cacheScope` for the whole server's cacheable
   *   methods (`tools/list`, `prompts/list`, `server/discover`, …). Per-resource
   *   hints go on the `@Resource` decorator instead.
   * - `inputRequired` — `maxRounds`, `roundTimeoutMs` for MRTR.
   * - `jsonSchemaValidator` — swap the JSON Schema validation engine.
   */
  server?: Omit<ServerOptions, 'instructions' | 'capabilities'>;
  /**
   * Authentication strategies and request authorizers for the MCP endpoint.
   * See {@link McpAuthOptions}.
   */
  auth?: McpAuthOptions;
};

/**
 * Options for configuring a feature module with MCP capabilities
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type McpFeatureOptions = {
  // TODO: Maybe its needed to implement Guards for all capabilities in this module o a specific logger configuration
};

export type McpModuleAsyncOptions = {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<McpModuleOptions> | McpModuleOptions;
  inject?: any[];
  /**
   * Providers registered next to the module — typically the classes named in
   * `auth.strategies` / `auth.authorizers`. They are still resolvable when
   * declared in any other module.
   */
  providers?: Provider[];
  /**
   * Serve the RFC 9728 Protected Resource Metadata endpoint.
   *
   * Static, outside the factory, because Nest fixes a module's controllers
   * before `useFactory` runs. The document itself comes from
   * `auth.protectedResource` returned by the factory; without it the endpoint
   * answers `404`. `forRoot` needs no flag: it registers the endpoint whenever
   * `auth.protectedResource` is set.
   * @default false
   */
  protectedResourceMetadata?: boolean;
};
