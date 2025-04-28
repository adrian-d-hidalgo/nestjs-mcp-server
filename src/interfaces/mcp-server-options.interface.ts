import { ProtocolOptions } from '@modelcontextprotocol/sdk/shared/protocol';
import {
  Implementation,
  ServerCapabilities,
} from '@modelcontextprotocol/sdk/types';
import { Provider, Type } from '@nestjs/common';

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
export interface McpLoggingOptions {
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
}

/**
 * Options for configuring the global MCP server module
 */
export interface McpModuleOptions {
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
  transports?: McpModuleTransportOption[];
}

export type McpModuleTransportOption = {
  controller: Type<any>;
  service: Provider;
};

/**
 * Options for configuring a feature module with MCP capabilities
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface McpFeatureOptions {
  // TODO: Maybe its needed to implement Guards for all capabilities in this module o a specific logger configuration
}
