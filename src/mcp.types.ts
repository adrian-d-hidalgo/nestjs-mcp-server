import type {
  CreateMcpHandlerOptions,
  Implementation,
  ProtocolOptions,
  ServerCapabilities as SdkServerCapabilities,
  ServerOptions as SdkServerOptions,
  StandardSchemaWithJSON,
} from '@modelcontextprotocol/server';
import { Provider, Type } from '@nestjs/common';

// Re-exported, not redeclared, so every type appearing in this package's public
// signatures is nameable from `@nestjs-mcp/server`. The SDK is our dependency,
// not the consumer's — under pnpm's strict layout they cannot import it.
export type ServerCapabilities = SdkServerCapabilities;
export type ServerOptions = SdkServerOptions;

/**
 * The schema type accepted by `paramsSchema` / `argsSchema`.
 *
 * Any Standard Schema implementation that can emit JSON Schema — Zod v4,
 * ArkType, Valibot. Replaces the Zod-raw-shape form used before 2.0: the SDK's
 * `zod-compat` module no longer exists, and its internal `ZodRawShape` is not
 * exported, so a bare shape object is no longer expressible.
 *
 * @example
 * ```typescript
 * // before 2.0
 * paramsSchema: { id: z.string() }
 * // 2.0
 * paramsSchema: z.object({ id: z.string() })
 * ```
 */
export type McpSchema = StandardSchemaWithJSON;

export type McpServerOptions = {
  serverInfo: Implementation;
  options?: ServerOptions;
  logging?: McpLoggingOptions;
};

/**
 * Options for configuring MCP server logging
 */
export type McpLoggingOptions = {
  /**
   * Enable or disable logging
   * @default true
   */
  enabled?: boolean;

  /**
   * Logging verbosity
   * @default 'verbose'
   */
  level?: 'debug' | 'verbose' | 'log' | 'warn' | 'error';
};

/**
 * Options for the stateless MCP HTTP endpoint.
 *
 * Passed through to the SDK's `createMcpHandler`. `Omit` rather than `Pick` so
 * options the SDK adds later arrive without a change here; `onerror` is ours,
 * wired to the Nest logger so handler failures land beside everything else.
 *
 * The option that matters most is `legacy`:
 *
 * - `'stateless'` (default) — 2025-era clients are served per request from the
 *   same factory. `GET` and `DELETE`, which were session operations, answer
 *   `405`. **Every currently published MCP client SDK speaks this era**, so
 *   this is the setting that keeps real clients working.
 * - `'reject'` — modern-only. Rejects 2025-era traffic with the
 *   unsupported-protocol-version error. Verified to break both
 *   `@modelcontextprotocol/sdk@1` and `@modelcontextprotocol/client@2`
 *   clients, so choose it only when you control every caller.
 */
export type McpTransportOptions = Omit<CreateMcpHandlerOptions, 'onerror'>;

/**
 * Options for configuring the global MCP server module
 */
export type McpModuleOptions = {
  /**
   * Additional modules to import
   */
  imports?: Type<any>[];
  /**
   * Providers to register in the module
   * These will be available globally
   */
  providers?: Provider[];
  /**
   * Name of the MCP server
   */
  name: string;
  /**
   * Version of the MCP server
   */
  version: string;
  /**
   * Description to give the AI about the server
   */
  instructions?: string;
  /**
   * Describes the server's purpose or behavior for the AI
   */
  capabilities?: ServerCapabilities;
  /**
   * Protocol-specific options
   */
  protocolOptions?: ProtocolOptions;
  /**
   * Options for configuring MCP server logging
   */
  logging?: McpLoggingOptions;
  /**
   * Options for the stateless MCP HTTP endpoint
   */
  transport?: McpTransportOptions;
  /**
   * The SDK's own `ServerOptions`, passed through verbatim.
   *
   * `Omit` rather than `Pick` so options the SDK adds later arrive without a
   * change here. `instructions` and `capabilities` are omitted because they
   * already have dedicated fields above; anything set here wins over them.
   *
   * This is where the protocol features that are configured server-wide live:
   *
   * - `requestState.verify` — validates the opaque state a multi-round-trip
   *   handler echoes back. **This is what lets an MRTR retry land on a
   *   different instance safely**: without a verify hook the state is
   *   client-supplied and tamperable.
   * - `cacheHints` — `ttlMs` / `cacheScope` for the whole server's cacheable
   *   methods (`tools/list`, `prompts/list`, `server/discover`, …). Per-resource
   *   hints go on the `@Resource` decorator instead.
   * - `inputRequired` — `maxRounds`, `roundTimeoutMs` for MRTR.
   * - `jsonSchemaValidator` — swap the JSON Schema validation engine.
   */
  server?: Omit<ServerOptions, 'instructions' | 'capabilities'>;
};

/**
 * Options for configuring a feature module with MCP capabilities
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type McpFeatureOptions = {
  // TODO: Maybe its needed to implement Guards for all capabilities in this module o a specific logger configuration
};

export type McpModuleAsyncOptions = {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<McpModuleOptions> | McpModuleOptions;
  inject?: any[];
};
