import { Injectable, SetMetadata } from '@nestjs/common';

import {
  PromptOptions,
  ResourceOptions,
  ToolOptions,
} from '../interfaces/capabilities.interface';
import { MCP_PROMPT, MCP_RESOURCE, MCP_TOOL } from './capabilities.constants';

/**
 * Metadata key to mark a class as an MCP Resolver.
 */
export const MCP_RESOLVER = '__mcp_resolver__';

/**
 * Metadata key to attach guards to a Resolver class or method.
 */
export const MCP_GUARDS = '__mcp_guards__';

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
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    SetMetadata(MCP_RESOURCE, {
      ...options,
      methodName: propertyKey,
    })(target, propertyKey, descriptor);
    return descriptor;
  };
}
