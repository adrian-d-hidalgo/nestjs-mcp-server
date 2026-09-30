import type { McpExecutionContext } from '../interfaces/context.interface';
import type { McpContext } from '../interfaces/handler-context.interface';
import type { McpAuthInfo } from '../mcp.types';

const isExecutionContext = (
  ctx: McpContext | McpExecutionContext,
): ctx is McpExecutionContext =>
  typeof (ctx as Partial<McpExecutionContext>).getContext === 'function';

/** What the SDK forwarded, else what the auth layer set on the request. */
const fromContext = (ctx: McpContext): McpAuthInfo | undefined =>
  ctx.http?.authInfo ?? ctx.request?.auth;

/**
 * The effective `AuthInfo` of the current MCP request — what
 * `auth.strategies` produced and `auth.authorizers` shaped — or `undefined`
 * for an anonymous one (`auth.optional`, a `public` capability, or no `auth`
 * configured).
 *
 * Works with a handler's {@link McpContext} (its last argument) and with the
 * {@link McpExecutionContext} a `@UseGuards` guard receives, so handlers and
 * guards read identity the same way. `TExtra` types `extra`; it is an
 * assertion about what your own strategies and authorizers put there, not a
 * runtime check.
 *
 * @example
 * ```typescript
 * type TenantExtra = { tenant: string }; // a type alias, not an interface
 *
 * @Tool({ name: 'list_notes' })
 * listNotes(ctx: McpContext) {
 *   const tenant = getAuthInfo<TenantExtra>(ctx)?.extra?.tenant;
 * }
 * ```
 */
export function getAuthInfo<
  TExtra extends Record<string, unknown> = Record<string, unknown>,
>(ctx: McpContext | McpExecutionContext): McpAuthInfo<TExtra> | undefined {
  const auth = isExecutionContext(ctx)
    ? typeof ctx.getAuthInfo === 'function'
      ? ctx.getAuthInfo()
      : fromContext(ctx.getContext())
    : fromContext(ctx);
  return auth as McpAuthInfo<TExtra> | undefined;
}
