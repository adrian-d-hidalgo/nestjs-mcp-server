import type { Type } from '@nestjs/common';

import type { McpHandlerArgs } from '../types/handler-args.types';
import type {
  AuthenticatedRequest,
  McpContext,
} from './handler-context.interface';

/**
 * Execution context for MCP operations.
 * Provides access to MCP-specific request information and handler metadata.
 *
 * Unlike NestJS's ExecutionContext, this interface is tailored specifically
 * for MCP protocol operations and does not include HTTP/WebSocket/RPC abstractions.
 */
export interface McpExecutionContext {
  /**
   * Returns the context type identifier.
   * Always returns 'mcp' for MCP execution contexts.
   */
  getType(): 'mcp';

  /**
   * Returns the handler function being executed.
   * This is the method decorated with @Tool, @Prompt, or @Resource.
   */
  getHandler(): (...args: any[]) => any;

  /**
   * Returns the class that contains the handler.
   * This is typically the @Resolver class.
   */
  getClass(): Type<any>;

  /**
   * Returns the full MCP context for this invocation — the SDK's `mcpReq`
   * (request id, method, `_meta`, the 2026-07-28 envelope), `http.authInfo`,
   * and the Express request.
   *
   * Replaces `getSessionId()`, which was removed in 2.0: protocol revision
   * 2026-07-28 retired sessions, so there is no identifier to return and no
   * session store to look one up in. A guard that needs the caller's identity
   * should read {@link getRequest} or `getContext().http?.authInfo`.
   */
  getContext(): McpContext;

  /**
   * Returns the arguments passed to the handler.
   * The return type varies based on the handler type (tool/prompt/resource).
   *
   * @template T - The specific handler args type
   *
   * @example
   * ```typescript
   * const args = context.getArgs();
   * if (args.type === 'tool') {
   *   console.log(args.params); // Tool parameters
   * }
   * ```
   */
  getArgs<T = McpHandlerArgs>(): T;

  /**
   * Returns the underlying HTTP request object.
   * Provides direct access to Express request without requiring switchToHttp().
   *
   * Since 2.0 this is the request the capability was **invoked** on. In 1.x it
   * was the request that opened the connection — the `initialize` POST or the
   * `GET /sse` handshake — frozen for the connection's life. Guards reading an
   * `Authorization` header now see the value sent with this call.
   *
   * @template R - The request type (defaults to Express Request)
   */
  getRequest<R = AuthenticatedRequest>(): R;
}
