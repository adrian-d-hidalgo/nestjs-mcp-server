import { CacheHint } from '@modelcontextprotocol/server';
import { SetMetadata } from '@nestjs/common';

import type { McpCapabilityToggle } from '../interfaces/registration-context.interface';

export interface ResourceBaseOptions {
  name: string;
  /**
   * Whether this resource is available to the client making this request.
   * Evaluated once per request; omit for the default (always enabled).
   */
  enabled?: McpCapabilityToggle;
  /**
   * Cache hint (`ttlMs` / `cacheScope`) attached to this resource's
   * `resources/read` result, letting a client cache it instead of re-fetching.
   *
   * Resource-only by design: `tools/list` and `prompts/list` return one result
   * for the whole server, so a per-capability hint would have nowhere to go.
   * Use `server.cacheHints` in the module options for those.
   */
  cacheHint?: CacheHint;
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

export interface ResourceTemplateWithMetadataOptions extends ResourceTemplateOptions {
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
