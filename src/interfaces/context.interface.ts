import type { Type } from '@nestjs/common';
import type { Request } from 'express';

import type { McpHandlerArgs } from '../types/handler-args.types';

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
   * Returns the current MCP session ID.
   * Each client connection maintains a unique session identifier.
   */
  getSessionId(): string;

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
   * @template R - The request type (defaults to Express Request)
   */
  getRequest<R = Request>(): R;
}
