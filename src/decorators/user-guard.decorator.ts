import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key to attach guards to a Resolver class or method.
 */
export const MCP_GUARDS = '__mcp_guards__';

/**
 * Decorator to attach one or more guards to a Resolver class or method.
 * Accepts guard classes or instances implementing CanActivate.
 *
 * @param guards One or more guard classes or instances
 * @example
 * @UseGuards(MyGuard)
 * @Resolver('workspace')
 * export class MyResolver { ... }
 */
export function UseGuards(...guards: any[]): ClassDecorator & MethodDecorator {
  return SetMetadata(MCP_GUARDS, guards);
}
