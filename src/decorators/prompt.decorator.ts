import { SetMetadata } from '@nestjs/common';

import { PromptArgsRawShape } from '../mcp.types';

export interface PromptBaseOptions {
  name: string;
}

export interface PromptWithDescriptionOptions extends PromptBaseOptions {
  description: string;
}

export interface PromptWithArgsSchemaOptions extends PromptBaseOptions {
  argsSchema: PromptArgsRawShape;
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
