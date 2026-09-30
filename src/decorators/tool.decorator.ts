import { Icon, ToolAnnotations } from '@modelcontextprotocol/server';
import { SetMetadata } from '@nestjs/common';

import { assertCapabilityAccess } from '../services/capability-scopes';

import type { McpCapabilityToggle } from '../interfaces/registration-context.interface';
import type { McpSchema } from '../mcp.types';

export interface ToolBaseOptions {
  name: string;
  /**
   * Whether this tool is available to the client making this request.
   * Evaluated once per request; omit for the default (always enabled).
   */
  enabled?: McpCapabilityToggle;
  /**
   * OAuth scopes the caller must hold to call this tool.
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
   * Lets a caller no `auth.strategies` recognized call this tool.
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
  // Fails at class definition — before the app boots — on a scope no OAuth
  // client could ever be granted or challenged with.
  assertCapabilityAccess(options, `@Tool "${options.name}"`);

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
