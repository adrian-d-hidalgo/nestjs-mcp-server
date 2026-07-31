// Core components
export * from './mcp.module';
export * from './mcp.types';

// Interfaces
export * from './interfaces';

// Types
export * from './types/handler-args.types';

// Services
export * from './services';

// Decorators
export * from './decorators';

// The stateless MCP endpoint. `McpHttpService` is exported for its `notify`
// facade, which publishes change events onto open `subscriptions/listen`
// streams — the only way this library can emit `list_changed`.
export * from './transports/http';

// Curated MCP SDK re-exports (MRTR helpers, result types, option types)
export * from './sdk';
