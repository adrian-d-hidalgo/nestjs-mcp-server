import { UriTemplate } from '@modelcontextprotocol/server';

import {
  MCP_PROMPT,
  MCP_RESOURCE,
  MCP_TOOL,
  type PromptOptions,
  type ResourceOptions,
  type ToolOptions,
} from '../decorators';
import { resolveCapabilityAccess } from '../services/capability-scopes';
import type {
  DiscoveryService,
  MethodWithMetadata,
} from '../services/discovery.service';

/**
 * Internal to `McpAuthService` and `RegistryService`: anonymous access to
 * `public` capabilities. Not part of the public API — nothing here is
 * re-exported from the package entry.
 */

/** Every capability declared `public`, by the identifier a request names. */
export interface PublicCapabilityIndex {
  tools: Set<string>;
  prompts: Set<string>;
  /** Fixed resource URIs. */
  resources: Set<string>;
  /** Resource templates, matched against a `resources/read` URI. */
  templates: UriTemplate[];
}

/**
 * Methods an anonymous request may always carry once the module declares a
 * public capability: the handshake of either protocol era, liveness, and the
 * lists (which then list only public capabilities).
 */
const ALWAYS_ADMITTED = new Set([
  'initialize',
  'server/discover',
  'ping',
  'tools/list',
  'prompts/list',
  'resources/list',
  'resources/templates/list',
]);

/** Whether a discovered capability is public, after resolver defaults. */
const isPublic = (method: MethodWithMetadata<object>): boolean =>
  resolveCapabilityAccess(method.metadata, method.instance.constructor)
    .isPublic;

/**
 * Collects every public capability once, at boot.
 *
 * @returns `undefined` when none is public, which keeps the authentication
 * path exactly as it is without this feature (no body inspection at all).
 */
export function buildPublicIndex(
  discovery: DiscoveryService,
): PublicCapabilityIndex | undefined {
  const tools = discovery
    .getAllMethodsWithMetadata<ToolOptions>(MCP_TOOL)
    .filter(isPublic)
    .map(({ metadata }) => metadata.name);
  const prompts = discovery
    .getAllMethodsWithMetadata<PromptOptions>(MCP_PROMPT)
    .filter(isPublic)
    .map(({ metadata }) => metadata.name);
  const resources = discovery
    .getAllMethodsWithMetadata<ResourceOptions>(MCP_RESOURCE)
    .filter(isPublic)
    .map(({ metadata }) => metadata);

  if (!tools.length && !prompts.length && !resources.length) return undefined;

  return {
    tools: new Set(tools),
    prompts: new Set(prompts),
    resources: new Set(
      resources.flatMap((metadata) =>
        'uri' in metadata ? [metadata.uri] : [],
      ),
    ),
    templates: resources.flatMap((metadata) =>
      'template' in metadata ? [new UriTemplate(metadata.template)] : [],
    ),
  };
}

/** The string at `params[key]`, or `undefined`. */
const param = (message: Record<string, unknown>, key: string): unknown =>
  message.params && typeof message.params === 'object'
    ? (message.params as Record<string, unknown>)[key]
    : undefined;

function isPublicMessage(
  message: unknown,
  index: PublicCapabilityIndex,
): boolean {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return false;
  }
  const record = message as Record<string, unknown>;
  const { method } = record;
  if (typeof method !== 'string') return false;

  if (ALWAYS_ADMITTED.has(method) || method.startsWith('notifications/')) {
    return true;
  }

  switch (method) {
    case 'tools/call': {
      const name = param(record, 'name');
      return typeof name === 'string' && index.tools.has(name);
    }
    case 'prompts/get': {
      const name = param(record, 'name');
      return typeof name === 'string' && index.prompts.has(name);
    }
    case 'resources/read': {
      const uri = param(record, 'uri');
      return (
        typeof uri === 'string' &&
        (index.resources.has(uri) ||
          index.templates.some((template) => template.match(uri) !== null))
      );
    }
    default:
      return false;
  }
}

/**
 * Whether a request no strategy recognized may be served anonymously: every
 * JSON-RPC message in its already-parsed body (one message or a batch) is
 * admitted — see {@link ALWAYS_ADMITTED}, `notifications/*`, and a
 * call/get/read naming a public capability. Anything else, including a
 * missing, empty or malformed body, is refused (fail closed).
 */
export function isPublicRequest(
  body: unknown,
  index: PublicCapabilityIndex,
): boolean {
  const messages = Array.isArray(body) ? body : [body];
  if (!messages.length) return false;
  return messages.every((message) => isPublicMessage(message, index));
}
