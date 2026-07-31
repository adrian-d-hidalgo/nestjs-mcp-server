import type { Variables } from '@modelcontextprotocol/server';

import type { McpContext } from '../interfaces/handler-context.interface';

/**
 * Arguments for resource URI handlers
 */
export interface ResourceUriHandlerArgs {
  readonly type: 'resource:uri';
  readonly uri: URL;
  readonly extra: McpContext;
}

/**
 * Arguments for resource template handlers with variable interpolation
 */
export interface ResourceTemplateHandlerArgs {
  readonly type: 'resource:template';
  readonly uri: URL;
  /**
   * Interpolated URI-template variables. Typed with the SDK's own `Variables`,
   * so an exploded variable correctly widens to `string[]` — 1.x declared
   * `Record<string, string>`, which mistyped those.
   */
  readonly variables?: Variables;
  readonly extra: McpContext;
}

/**
 * Arguments for prompt handlers with optional typed arguments
 */
export interface PromptHandlerArgs {
  readonly type: 'prompt';
  readonly args?: any;
  readonly extra: McpContext;
}

/**
 * Arguments for tool handlers with optional typed parameters
 */
export interface ToolHandlerArgs {
  readonly type: 'tool';
  readonly params?: any;
  readonly extra: McpContext;
}

/**
 * Union of all possible handler argument types.
 * Use the `type` discriminator to narrow to specific handler type.
 *
 * @example
 * ```typescript
 * function handleArgs(args: McpHandlerArgs) {
 *   switch (args.type) {
 *     case 'tool':
 *       // TypeScript knows args has 'params' and 'extra'
 *       console.log(args.params);
 *       break;
 *     case 'prompt':
 *       // TypeScript knows args has 'args' and 'extra'
 *       console.log(args.args);
 *       break;
 *     case 'resource:uri':
 *       // TypeScript knows args has 'uri' and 'extra'
 *       console.log(args.uri);
 *       break;
 *     case 'resource:template':
 *       // TypeScript knows args has 'uri', 'variables', and 'extra'
 *       console.log(args.uri, args.variables);
 *       break;
 *   }
 * }
 * ```
 */
export type McpHandlerArgs =
  | ResourceUriHandlerArgs
  | ResourceTemplateHandlerArgs
  | PromptHandlerArgs
  | ToolHandlerArgs;
