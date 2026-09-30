import type { Type } from '@nestjs/common';
import type { Observable } from 'rxjs';

import type { McpAuthInfo } from '../mcp.types';
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
 *
 * @template TExtra The shape of `AuthInfo.extra` your strategies and
 * authorizers produce; see {@link McpAuthInfo}. Defaults to the SDK's untyped
 * record, so `McpExecutionContext` alone means exactly what it did in 2.0.0.
 */
export interface McpExecutionContext<
  TExtra extends Record<string, unknown> = Record<string, unknown>,
> {
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

  /**
   * The effective `AuthInfo` for this invocation — what the configured
   * `auth.strategies` produced and `auth.authorizers` narrowed — or
   * `undefined` for an anonymous request.
   *
   * Optional so existing implementers and test doubles of this interface keep
   * compiling; the library's own context always provides it.
   *
   * Typed through the interface's `TExtra` parameter — declare the guard's
   * parameter as `McpExecutionContext<TenantExtra>` — or read it with
   * `getAuthInfo<TenantExtra>(context)`. With the default parameter this is
   * the SDK's `AuthInfo`, as in 2.0.0.
   */
  getAuthInfo?(): McpAuthInfo<TExtra> | undefined;
}

/**
 * A guard for MCP capabilities, attached with `@UseGuards` on a resolver or a
 * capability method.
 *
 * Implement this instead of Nest's `CanActivate` when the guard reads the
 * {@link McpExecutionContext}: `CanActivate` types its parameter as Nest's
 * `ExecutionContext`, so `implements CanActivate` with an `McpExecutionContext`
 * parameter does not compile under strict mode. `@UseGuards` accepts both.
 *
 * @template TExtra The shape of `AuthInfo.extra`, as in {@link McpExecutionContext}.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class HeaderGuard implements McpGuard {
 *   canActivate(context: McpExecutionContext): boolean {
 *     return Boolean(context.getRequest().headers.authorization);
 *   }
 * }
 * ```
 */
export interface McpGuard<
  TExtra extends Record<string, unknown> = Record<string, unknown>,
> {
  canActivate(
    context: McpExecutionContext<TExtra>,
  ): boolean | Promise<boolean> | Observable<boolean>;
}
