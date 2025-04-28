import { SetMetadata } from '@nestjs/common';

import {
  PromptOptions,
  ResourceOptions,
  ToolOptions,
} from '../interfaces/capabilities.interface';
import { MCP_PROMPT, MCP_RESOURCE, MCP_TOOL } from './capabilities.constants';

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
    target: any,
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
    target: any,
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

/**
 * Decorator for marking a method as an MCP Resource provider.
 * Use with @McpProvider.
 *
 * Hay dos modos de uso para los recursos:
 *
 * 1. Recurso con URI fija:
 * @Resource({
 *   name: 'nombreRecurso',
 *   uri: 'resource://midominio/recurso'
 * })
 *
 * 2. Recurso con plantilla (para parámetros dinámicos):
 * @Resource({
 *   name: 'nombreRecurso',
 *   template: 'resource://midominio/recurso/{parametro}'
 * })
 *
 * También se puede proporcionar solo el nombre como string:
 * @Resource('nombreRecurso')
 *
 * @param options Resource configuration or just the name as a string
 */
export function Resource(options: ResourceOptions) {
  // Handle both string and object formats for backward compatibility
  const resourceOptions =
    typeof options === 'string' ? { name: options } : options;

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    SetMetadata(MCP_RESOURCE, {
      ...resourceOptions,
      methodName: propertyKey,
    })(target, propertyKey, descriptor);
    return descriptor;
  };
}
