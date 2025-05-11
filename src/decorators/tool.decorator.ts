import { ToolAnnotations } from '@modelcontextprotocol/sdk/types';
import { SetMetadata } from '@nestjs/common';
import { ZodRawShape } from 'zod';

export interface ToolBaseOptions {
  name: string;
}

export interface ToolWithDescriptionOptions extends ToolBaseOptions {
  description: string;
}

export interface ToolWithParamsSchemaOptions extends ToolBaseOptions {
  paramsSchema: ZodRawShape;
}

export interface ToolWithParamsSchemaAndDescriptionOptions
  extends ToolWithParamsSchemaOptions {
  description: string;
}

export interface ToolWithAnnotationsOptions extends ToolBaseOptions {
  annotations: ToolAnnotations;
}

export interface ToolWithAnnotationsAndDescriptionOptions
  extends ToolWithAnnotationsOptions {
  description: string;
}

export interface ToolWithParamsSchemaAndAnnotationsOptions
  extends ToolBaseOptions {
  paramsSchema: ZodRawShape;
  annotations: ToolAnnotations;
}

export interface ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions
  extends ToolWithParamsSchemaAndAnnotationsOptions {
  description: string;
}

export type ToolOptions =
  | ToolBaseOptions
  | ToolWithDescriptionOptions
  | ToolWithParamsSchemaOptions
  | ToolWithParamsSchemaAndDescriptionOptions
  | ToolWithAnnotationsOptions
  | ToolWithAnnotationsAndDescriptionOptions
  | ToolWithParamsSchemaAndAnnotationsOptions
  | ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions;

export const MCP_TOOL = '__mcp_tool__';

/**
 * Decorator for marking a method as an MCP Tool.
 * Use with @McpProvider.
 *
 * La herramienta debe devolver un objeto con el formato:
 * {
 *   content: [
 *     {
 *       type: 'text', // Puede ser 'text', 'image', 'video', 'audio', etc.
 *       text: 'Texto de la respuesta',
 *     }
 *   ]
 * }
 *
 * @param options Tool configuration
 */
export function Tool(options: ToolOptions) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    SetMetadata(MCP_TOOL, {
      ...options,
      methodName: propertyKey,
    })(target, propertyKey, descriptor);

    return descriptor;
  };
}
