# Migration to Stateless Mode (Without Session Management)

## Overview

This migration removes session management from the NestJS MCP Server implementation, following the recommended "Without Session Management" approach from the `@modelcontextprotocol/sdk` documentation.

## Key Changes

### 1. Removed Components

- **SessionManager** (`src/services/session.manager.ts`) - No longer needed in stateless mode
- **SSE Transport** (`src/transports/sse/`) - Removed entirely as SSE inherently requires session management
- **Session-related types** - Removed `sse` from `McpModuleTransportOptions`

### 2. Updated Components

#### StreamableService (`src/transports/streamable/streamable.service.ts`)
- Creates a new transport for each request with `sessionIdGenerator: undefined`
- Uses `AsyncLocalStorage` to pass Request context to guards
- Removed GET and DELETE endpoints (only POST is needed in stateless mode)
- Simplified error handling

#### StreamableController (`src/transports/streamable/streamable.controller.ts`)
- Removed GET and DELETE endpoints
- Only handles POST requests at `/mcp`

#### RegistryService (`src/services/registry.service.ts`)
- Removed SessionManager dependency
- Uses `AsyncLocalStorage` to access Request in guards
- Removed session validation logic
- Removed `headers` and `body` extensions from `RequestHandlerExtra`

#### McpCoreModule (`src/mcp-core.module.ts`)
- Removed SessionManager provider
- Removed SSE transport configuration
- Simplified transport configuration to only support streamable

#### Type Definitions (`src/mcp.types.ts`)
- `RequestHandlerExtra` now directly uses SDK type without extensions
- Removed `sse` from `McpModuleTransportOptions`
- Simplified `McpModuleTransportOptions.streamable.options`

#### Context Interface (`src/interfaces/context.interface.ts`)
- `getSessionId()` now returns `string | undefined` (sessionId may not exist in stateless mode)

### 3. How It Works Now

#### Request Flow
1. Client sends POST request to `/mcp`
2. `StreamableController` receives request
3. `StreamableService.handlePostRequest()` wraps execution in `AsyncLocalStorage.run()`
4. Creates new `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined`
5. Connects server to transport
6. Handles request
7. Transport is closed when response completes

#### Guard Access to Request
Guards can access the original Request object through the execution context:

```typescript
@Injectable()
export class MyGuard implements CanActivate {
  canActivate(context: McpExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    // ... validation logic
    return true;
  }
}
```

The Request is available via `AsyncLocalStorage` which is set up in `StreamableService.handlePostRequest()`.

## Breaking Changes

### For Users

1. **SSE Transport Removed**: If you were using SSE transport, you must migrate to streamable HTTP
2. **Transport Configuration**: Remove `sse` configuration from `McpModule.forRoot()`
3. **SessionManager**: No longer exported or available for injection
4. **RequestHandlerExtra**: No longer includes `headers` and `body` properties (use guards to access Request)

### Migration Example

**Before:**
```typescript
McpModule.forRoot({
  name: 'My Server',
  version: '1.0.0',
  transports: {
    streamable: { enabled: true },
    sse: { enabled: true }, // ❌ No longer supported
  },
})
```

**After:**
```typescript
McpModule.forRoot({
  name: 'My Server',
  version: '1.0.0',
  transports: {
    streamable: { enabled: true },
  },
})
```

Or simply:
```typescript
McpModule.forRoot({
  name: 'My Server',
  version: '1.0.0',
  // streamable is enabled by default
})
```

## Benefits

1. **Simpler Architecture**: No session state to manage
2. **Better Scalability**: Each request is independent
3. **SDK Compliance**: Follows recommended approach from `@modelcontextprotocol/sdk`
4. **Reduced Memory Usage**: No session storage overhead
5. **Easier Debugging**: No cross-request state issues

## Testing

All existing tests have been updated and pass successfully:
- 9 test suites pass
- 50 tests pass
- No breaking changes to public API (except removed features)
