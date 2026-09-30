import { CacheHint } from '@modelcontextprotocol/server';
import { SetMetadata } from '@nestjs/common';

import { assertCapabilityAccess } from '../services/capability-scopes';

import type { McpCapabilityToggle } from '../interfaces/registration-context.interface';

export interface ResourceBaseOptions {
  name: string;
  /**
   * Whether this resource is available to the client making this request.
   * Evaluated once per request; omit for the default (always enabled).
   */
  enabled?: McpCapabilityToggle;
  /**
   * OAuth scopes the caller must hold to read this resource.
   *
   * Checked by the MCP SDK **before** dispatch, against the effective
   * `AuthInfo` (after `auth.authorizers`). A caller lacking them gets `403
   * insufficient_scope` naming these scopes — or, with `auth.hideOutOfScope`,
   * finds the capability disabled and unlisted. A request with no `AuthInfo`
   * is not challenged when `auth` is not configured; when it is configured
   * (`optional: true`), an anonymous request finds the capability disabled.
   *
   * Each entry must be an OAuth scope-token (no spaces, quotes, backslashes
   * or control characters); an invalid one throws when the class is defined.
   */
  scopes?: [string, ...string[]];
  /**
   * Lets a caller no `auth.strategies` recognized read this resource.
   *
   * Only meaningful when `auth` is configured without `optional: true`: such
   * a request is normally answered `401`, but one whose every JSON-RPC
   * message is a handshake (`initialize`, `server/discover`, `ping`,
   * `notifications/*`), a list, or a call/get/read of a public capability is
   * served anonymously, and it sees **only** public capabilities. A request
   * carrying valid credentials is unaffected — public capabilities are
   * available to everyone.
   *
   * Cannot be combined with `scopes` (throws when the class is defined).
   * Overrides a `@Resolver({ public })` default.
   * @default false
   */
  public?: boolean;
  /**
   * Overrides `auth.hideOutOfScope` (and a `@Resolver({ hideOutOfScope })`
   * default) for this capability: `true` disables it for a caller whose grant
   * does not satisfy its `scopes`, `false` keeps it listed and challenges.
   */
  hideOutOfScope?: boolean;
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
  // Fails at class definition — before the app boots — on a scope no OAuth
  // client could ever be granted or challenged with.
  assertCapabilityAccess(options, `@Resource "${options.name}"`);

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
