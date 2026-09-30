import type { AuthInfo } from '@modelcontextprotocol/server';
import { Injectable, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';

import type { AuthenticatedRequest } from '../interfaces/handler-context.interface';
import { MCP_AUTH_OPTIONS } from '../mcp.constants';
import type { McpAuthOptions } from '../mcp.types';
import { DiscoveryService } from '../services/discovery.service';
import { McpLoggerService } from '../services/logger.service';
import type { McpAuthStrategy } from './auth-strategy.interface';
import type { McpAuthorizer } from './authorizer.interface';
import { McpAuthService } from './mcp-auth.service';

/** Shared fixtures for the McpAuthService specs. */
interface Written {
  status?: number;
  headers: Record<string, string>;
  body?: string;
}

export const createResponse = (headersSent = false) => {
  const written: Written = { headers: {} };
  const res = {
    headersSent,
    writeHead: jest.fn((status: number, headers: Record<string, string>) => {
      written.status = status;
      written.headers = headers;
    }),
    end: jest.fn((body: string) => {
      written.body = body;
    }),
  };
  return { res: res as unknown as Response, written, raw: res };
};

export const createRequest = (
  headers: Record<string, string> = {},
  method = 'POST',
): AuthenticatedRequest => ({ headers, method }) as AuthenticatedRequest;

export const info = (overrides: Partial<AuthInfo> = {}): AuthInfo => ({
  token: 't',
  clientId: 'c',
  scopes: ['read'],
  ...overrides,
});

export const RESOURCE = 'https://example.com/mcp';
export const PRM_URL =
  'https://example.com/.well-known/oauth-protected-resource/mcp';

/** A strategy recording its calls and answering with `answer`. */
export const strategy = (
  answer: () => AuthInfo | null | Promise<AuthInfo | null>,
): { Class: Type<McpAuthStrategy>; calls: jest.Mock } => {
  const calls = jest.fn(answer);
  @Injectable()
  class TestStrategy implements McpAuthStrategy {
    authenticate(_request: AuthenticatedRequest) {
      return calls();
    }
  }
  return { Class: TestStrategy, calls };
};

export const authorizer = (
  answer: (auth: AuthInfo) => AuthInfo | Promise<AuthInfo>,
): Type<McpAuthorizer> => {
  @Injectable()
  class TestAuthorizer implements McpAuthorizer {
    authorize(_request: AuthenticatedRequest, auth: AuthInfo) {
      return answer(auth);
    }
  }
  return TestAuthorizer;
};

export interface TestLogger {
  log: jest.Mock;
  error: jest.Mock;
}

/** Builds an McpAuthService with the given options and a recording logger. */
export const buildAuthService = async (
  options: McpAuthOptions | undefined,
  providers: Type<unknown>[] = [
    ...(options?.strategies ?? []),
    ...(options?.authorizers ?? []),
  ],
  discovery?: DiscoveryService,
): Promise<{ service: McpAuthService; logger: TestLogger }> => {
  const logger: TestLogger = { log: jest.fn(), error: jest.fn() };
  const moduleRef = await Test.createTestingModule({
    providers: [
      McpAuthService,
      ...providers,
      ...(discovery
        ? [{ provide: DiscoveryService, useValue: discovery }]
        : []),
      { provide: MCP_AUTH_OPTIONS, useValue: options },
      { provide: McpLoggerService, useValue: logger },
    ],
  }).compile();
  await moduleRef.init();
  return { service: moduleRef.get(McpAuthService), logger };
};
