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
import { Request } from 'express';
import { ZodOptional, ZodType, ZodTypeDef } from 'zod';

export type PromptArgsRawShape = {
  [k: string]:
    | ZodType<string, ZodTypeDef, string>
    | ZodOptional<ZodType<string, ZodTypeDef, string>>;
};

export type RequestHandlerExtra = SdkRequestHandlerExtra<
  ServerRequest,
  ServerNotification
> & {
  request: Request;
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

export type McpLoggingOptions = {
  enabled?: boolean;
  level?: 'debug' | 'verbose' | 'log' | 'warn' | 'error';
};

export type McpModuleOptions = {
  imports?: Type<any>[];
  providers?: Provider[];
  name: string;
  version: string;
  instructions?: string;
  capabilities?: ServerCapabilities;
  protocolOptions?: ProtocolOptions;
  logging?: McpLoggingOptions;
  transports?: McpModuleTransportOptions;
};

export type McpModuleTransportOptions = {
  streamable?: {
    enabled: boolean;
    options?: Omit<
      StreamableHTTPServerTransportOptions,
      'onsessioninitialized' | 'sessionIdGenerator'
    >;
  };
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type McpFeatureOptions = {};

export type McpModuleAsyncOptions = {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<McpModuleOptions> | McpModuleOptions;
  inject?: any[];
};
