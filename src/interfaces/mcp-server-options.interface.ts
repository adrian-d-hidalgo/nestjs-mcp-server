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
export interface McpServerModuleOptions {
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
}

/**
 * Options for configuring a feature module with MCP capabilities
 */
export interface McpFeatureOptions {
  /**
   * Additional modules to import
   */
  imports?: Type<any>[];

  /**
   * Services that provide MCP capabilities.
   * Each service should be decorated with one of the capability decorators:
   * @Tool, @Prompt, or @Resource
   */
  capabilities?: Provider[];

  /**
   * Additional providers to register in the feature module
   * These will be available for injection within this module
   */
  providers?: Provider[];
}
