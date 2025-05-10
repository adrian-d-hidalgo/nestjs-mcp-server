import { SetMetadata } from '@nestjs/common';

export interface ResourceBaseOptions {
  name: string;
}

export interface ResourceUriOptions extends ResourceBaseOptions {
  uri: string;
}

export interface ResourceUriWithMetadataOptions extends ResourceUriOptions {
  metadata: Record<string, any>;
}

export interface ResourceTemplateOptions extends ResourceBaseOptions {
  template: string;
}

export interface ResourceTemplateWithMetadataOptions
  extends ResourceTemplateOptions {
  metadata: Record<string, any>;
}

export type ResourceOptions =
  | ResourceUriOptions
  | ResourceUriWithMetadataOptions
  | ResourceTemplateOptions
  | ResourceTemplateWithMetadataOptions;

export const MCP_RESOURCE = '__mcp_resource__';

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
