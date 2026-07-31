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

/**
 * `AsyncLocalStorage` carrying the Express request across the SDK handler into
 * the per-request server factory. See `McpHttpService`.
 */
export const MCP_REQUEST_SCOPE = Symbol('MCP_REQUEST_SCOPE');
