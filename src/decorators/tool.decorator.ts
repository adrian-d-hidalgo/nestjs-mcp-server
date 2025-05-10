import { ToolAnnotations } from '@modelcontextprotocol/sdk/types';
import { SetMetadata } from '@nestjs/common';
import { ZodRawShape } from 'zod';

export interface ToolBaseOptions {
  name: string;
}

export interface ToolWithDescriptionOptions extends ToolBaseOptions {
  description: string;
}

export interface ToolWithParamOrAnnotationsOptions extends ToolBaseOptions {
  paramsSchemaOrAnnotations: ZodRawShape | ToolAnnotations;
}

export interface ToolWithParamOrAnnotationsAndDescriptionOptions
  extends ToolWithParamOrAnnotationsOptions {
  description: string;
}

export interface ToolWithParamAndAnnotationsOptions extends ToolBaseOptions {
  paramsSchema: ZodRawShape;
  annotations: ToolAnnotations;
}

export interface ToolWithParamAndAnnotationsAndDescriptionOptions
  extends ToolWithParamAndAnnotationsOptions {
  description: string;
}

export type ToolOptions =
  | ToolBaseOptions
  | ToolWithDescriptionOptions
  | ToolWithParamOrAnnotationsOptions
  | ToolWithParamOrAnnotationsAndDescriptionOptions
  | ToolWithParamAndAnnotationsOptions
  | ToolWithParamAndAnnotationsAndDescriptionOptions;

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
