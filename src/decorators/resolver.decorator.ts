import { Injectable, SetMetadata } from '@nestjs/common';

import { MCP_RESOLVER_OPTIONS } from '../mcp.constants';
import { assertCapabilityAccess } from '../services/capability-scopes';

/**
 * Metadata key to mark a class as an MCP Resolver.
 */
export const MCP_RESOLVER = '__mcp_resolver__';

/**
 * The object form of `@Resolver`: a name plus access defaults inherited by
 * every `@Tool`, `@Prompt` and `@Resource` of the class.
 *
 * A capability's own option always wins over the resolver's, which wins over
 * the module's (`auth.hideOutOfScope`):
 *
 * - `scopes` — a capability declaring `scopes` **replaces** the resolver's
 *   (no merging). A capability declaring `public: true` drops them.
 * - `public` — a capability's `public` overrides it; a capability declaring
 *   its own `scopes` in a public resolver is protected, not public.
 * - `hideOutOfScope` — a capability's own value overrides it.
 */
export interface McpResolverOptions {
  /** Namespace for the resolver, stored exactly as `@Resolver('name')` does. */
  name?: string;
  /**
   * Default OAuth scopes for every capability of the class that declares
   * none. Validated as scope-tokens when the class is defined.
   */
  scopes?: [string, ...string[]];
  /**
   * Default `public` for every capability of the class. See `public` on
   * `@Tool`. Declaring both `public: true` and `scopes` here throws.
   */
  public?: boolean;
  /**
   * Default `hideOutOfScope` for every capability of the class, overriding
   * `auth.hideOutOfScope`.
   */
  hideOutOfScope?: boolean;
}

/**
 * Decorator for marking a class as an MCP Resolver.
 * Enables dependency injection and workspace grouping for MCP capabilities.
 *
 * @param options A namespace string (unchanged since 1.x), or
 * {@link McpResolverOptions} to also set access defaults for the class.
 * @example
 * @Resolver('my-workspace')
 * export class MyResolver { ... }
 *
 * @Resolver({ name: 'notes', scopes: ['notes:read'] })
 * export class NotesResolver { ... }
 */
export function Resolver(
  options?: string | McpResolverOptions,
): ClassDecorator {
  if (typeof options === 'object' && options !== null) {
    assertCapabilityAccess(
      options,
      options.name ? `@Resolver "${options.name}"` : '@Resolver',
    );
  }
  const workspace = typeof options === 'object' ? options?.name : options;

  return function (target: any) {
    Injectable()(target);
    SetMetadata(MCP_RESOLVER, workspace || true)(target);
    if (typeof options === 'object' && options !== null) {
      SetMetadata(MCP_RESOLVER_OPTIONS, {
        scopes: options.scopes,
        public: options.public,
        hideOutOfScope: options.hideOutOfScope,
      })(target);
    }
  };
}
