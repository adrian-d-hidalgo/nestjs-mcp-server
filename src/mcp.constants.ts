/**
 * Dependency injection tokens for MCP module providers.
 * Using Symbols ensures no naming collisions in the DI container.
 */

/** Main module configuration options */
export const MCP_MODULE_OPTIONS = Symbol('MCP_MODULE_OPTIONS');

/** MCP server configuration options (serverInfo, serverOptions) */
export const MCP_SERVER_OPTIONS = Symbol('MCP_SERVER_OPTIONS');

/** Logging configuration options */
export const MCP_LOGGING_OPTIONS = Symbol('MCP_LOGGING_OPTIONS');

/** Stateless HTTP endpoint configuration, passed to `createMcpHandler` */
export const MCP_TRANSPORT_OPTIONS = Symbol('MCP_TRANSPORT_OPTIONS');

/** Authentication and request-authorization options (`McpModuleOptions.auth`) */
export const MCP_AUTH_OPTIONS = Symbol('MCP_AUTH_OPTIONS');

/**
 * `AsyncLocalStorage` carrying the Express request across the SDK handler into
 * the per-request server factory. See `McpHttpService`.
 */
export const MCP_REQUEST_SCOPE = Symbol('MCP_REQUEST_SCOPE');

/**
 * Class metadata holding the `McpResolverOptions` defaults (`scopes`,
 * `public`, `hideOutOfScope`) of a resolver declared with the object form of
 * `@Resolver`. Absent for the string form, which keeps 2.0.0's metadata.
 */
export const MCP_RESOLVER_OPTIONS = '__mcp_resolver_options__';
