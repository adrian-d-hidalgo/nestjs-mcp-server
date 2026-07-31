import { Icon } from '@modelcontextprotocol/server';
import { SetMetadata } from '@nestjs/common';

import type { McpCapabilityToggle } from '../interfaces/registration-context.interface';
import type { McpSchema } from '../mcp.types';

export interface PromptBaseOptions {
  name: string;
  /**
   * Whether this prompt is available to the client making this request.
   * Evaluated once per request; omit for the default (always enabled).
   */
  enabled?: McpCapabilityToggle;
  /** Human-readable display name, shown in place of `name` where available. */
  title?: string;
  /** Icons a client may render alongside this prompt. */
  icons?: Icon[];
  /** Implementation-defined metadata passed through to the client verbatim. */
  _meta?: Record<string, unknown>;
}

export interface PromptWithDescriptionOptions extends PromptBaseOptions {
  description: string;
}

export interface PromptWithArgsSchemaOptions extends PromptBaseOptions {
  argsSchema: McpSchema;
}

export interface PromptWithDescriptionAndArgsSchemaOptions
  extends PromptWithDescriptionOptions, PromptWithArgsSchemaOptions {}

export type PromptOptions =
  | PromptBaseOptions
  | PromptWithDescriptionOptions
  | PromptWithArgsSchemaOptions
  | PromptWithDescriptionAndArgsSchemaOptions;

// Constantes de metadatos para decoradores de método
export const MCP_PROMPT = '__mcp_prompt__';

/**
 * Decorator for marking a method as an MCP Prompt.
 * Use with @McpProvider.
 *
 * El prompt debe devolver un objeto con el formato:
 * {
 *   messages: [
 *     {
 *       role: 'assistant',
 *       content: {
 *         type: 'text',
 *         text: 'Texto del mensaje'
 *       }
 *     }
 *   ]
 * }
 *
 * @param options Prompt configuration
 */
export function Prompt(options: PromptOptions) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    SetMetadata(MCP_PROMPT, {
      ...options,
      methodName: propertyKey,
    })(target, propertyKey, descriptor);

    return descriptor;
  };
}
