import { StreamableHTTPServerTransportOptions } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ProtocolOptions,
  RequestHandlerExtra as SdkRequestHandlerExtra,
} from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  Implementation,
  ServerCapabilities,
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { Provider, Type } from '@nestjs/common';
import { ZodOptional, ZodType, ZodTypeDef } from 'zod';

// This type exists in the MCP SDK but is not exported
export type PromptArgsRawShape = {
  [k: string]:
    | ZodType<string, ZodTypeDef, string>
    | ZodOptional<ZodType<string, ZodTypeDef, string>>;
};

export type RequestHandlerExtra = SdkRequestHandlerExtra<
  ServerRequest,
  ServerNotification
> & {
  headers: Record<string, string>;
};

export type ServerOptions = {
  instructions?: string;
  capabilities?: ServerCapabilities;
  protocolOptions?: ProtocolOptions;
};

export type McpServerOptions = {
  serverInfo: Implementation;
  options?: ServerOptions;
  logging?: McpLoggingOptions;
};

/**
 * Opciones para configurar el logging del servidor MCP
 */
export type McpLoggingOptions = {
  /**
   * Habilitar o deshabilitar el logging
   * @default true
   */
  enabled?: boolean;

  /**
   * Nivel de detalle del logging
   * @default 'verbose'
   */
  level?: 'debug' | 'verbose' | 'log' | 'warn' | 'error';
};

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
   * Options for configuring a feature module with MCP capabilities
   */
  transports?: McpModuleTransportOptions;
};

export type McpModuleTransportOptions = {
  streamable?: {
    enabled: boolean;
    /**
     * Streamable transport options. sessionIdGenerator is optional here, even if required in the SDK type.
     */
    options?: Omit<
      StreamableHTTPServerTransportOptions,
      'onsessioninitialized' | 'sessionIdGenerator'
    > & {
      sessionIdGenerator?: () => string | undefined;
    };
  };
  sse?: {
    enabled: boolean;
  };
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
