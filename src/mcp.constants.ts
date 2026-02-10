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

/** Transport configuration (SSE, Streamable) */
export const MCP_TRANSPORT_OPTIONS = Symbol('MCP_TRANSPORT_OPTIONS');

/** Session management options */
export const MCP_SESSION_OPTIONS = Symbol('MCP_SESSION_OPTIONS');
