import { Injectable } from '@nestjs/common';

import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key to mark a class as an MCP Resolver.
 */
export const MCP_RESOLVER = '__mcp_resolver__';

/**
 * Decorator for marking a class as an MCP Resolver.
 * Enables dependency injection and workspace grouping for MCP capabilities.
 *
 * @param workspace Optional workspace/namespace for grouping capabilities
 * @example
 * @Resolver('my-workspace')
 * export class MyResolver { ... }
 */
export function Resolver(workspace?: string): ClassDecorator {
  return function (target: any) {
    Injectable()(target);
    SetMetadata(MCP_RESOLVER, workspace || true)(target);
  };
}
