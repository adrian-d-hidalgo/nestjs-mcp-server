import { Icon, ToolAnnotations } from '@modelcontextprotocol/server';
import { SetMetadata } from '@nestjs/common';

import type { McpCapabilityToggle } from '../interfaces/registration-context.interface';
import type { McpSchema } from '../mcp.types';

export interface ToolBaseOptions {
  name: string;
  /**
   * Whether this tool is available to the client making this request.
   * Evaluated once per request; omit for the default (always enabled).
   */
  enabled?: McpCapabilityToggle;
  /** Human-readable display name, shown in place of `name` where available. */
  title?: string;
  /**
   * Schema for the tool's structured output.
   *
   * When present the SDK advertises it on `tools/list` and validates the
   * handler's `structuredContent` against it.
   */
  outputSchema?: McpSchema;
  /** Icons a client may render alongside this tool. */
  icons?: Icon[];
  /** Implementation-defined metadata passed through to the client verbatim. */
  _meta?: Record<string, unknown>;
}

export interface ToolWithDescriptionOptions extends ToolBaseOptions {
  description: string;
}

export interface ToolWithParamsSchemaOptions extends ToolBaseOptions {
  paramsSchema: McpSchema;
}

export interface ToolWithParamsSchemaAndDescriptionOptions extends ToolWithParamsSchemaOptions {
  description: string;
}

export interface ToolWithAnnotationsOptions extends ToolBaseOptions {
  annotations: ToolAnnotations;
}

export interface ToolWithAnnotationsAndDescriptionOptions extends ToolWithAnnotationsOptions {
  description: string;
}

export interface ToolWithParamsSchemaAndAnnotationsOptions extends ToolBaseOptions {
  paramsSchema: McpSchema;
  annotations: ToolAnnotations;
}

export interface ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions extends ToolWithParamsSchemaAndAnnotationsOptions {
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
