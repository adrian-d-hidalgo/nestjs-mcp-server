import { INestApplication, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import { jwtVerify, SignJWT } from 'jose';
import type { AddressInfo } from 'net';
import { z } from 'zod';

import {
  AuthenticatedRequest,
  AuthInfo,
  CallToolResult,
  McpAccessDeniedError,
  McpAuthorizer,
  McpAuthStrategy,
  McpContext,
  McpHttpError,
  McpUnauthorizedError,
  McpModule,
  OAuthError,
  OAuthErrorCode,
  Resolver,
  Tool,
} from '../../src';

/**
 * Shared fixtures of the auth e2e specs (`test/auth*.e2e-spec.ts`): the
 * strategies, authorizer and resolver a consumer would write, and helpers that
 * boot a module on an ephemeral port and speak the 2026 wire format to it.
 */

export const RESOURCE = 'https://mcp.example.com/mcp';
export const AUTHORIZATION_SERVER = 'https://auth.example.com';
export const PRM_PATH = '/.well-known/oauth-protected-resource/mcp';
export const PRM_URL = `https://mcp.example.com${PRM_PATH}`;

export const API_KEY = 'key-read-write';
export const RATE_LIMITED_KEY = 'key-rate-limited';
const SECRET = new TextEncoder().encode('e2e-secret-at-least-32-bytes-long!!');
const ISSUER = AUTHORIZATION_SERVER;

const ENVELOPE = {
  'io.modelcontextprotocol/clientInfo': { name: 'e2e', version: '1.0.0' },
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

/** API key from a custom header — a non-OAuth method with its own challenge. */
@Injectable()
export class ApiKeyStrategy implements McpAuthStrategy {
  readonly challenge = 'ApiKey header="x-api-key"';

  authenticate(request: AuthenticatedRequest): AuthInfo | null {
    const key = request.headers['x-api-key'];
    if (typeof key !== 'string') return null;

    if (key === RATE_LIMITED_KEY) {
      throw new McpHttpError(
        429,
        { error: 'too_many_requests' },
        { 'Retry-After': '30' },
      );
    }
    if (key !== API_KEY) {
      throw new McpUnauthorizedError('Unknown API key');
    }

    return {
      token: key,
      clientId: 'api-key-client',
      scopes: ['notes:read', 'notes:write'],
    };
  }
}

/** JWT access token via `Authorization: Bearer`, verified with `jose`. */
@Injectable()
export class JwtStrategy implements McpAuthStrategy {
  async authenticate(request: AuthenticatedRequest): Promise<AuthInfo | null> {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length);

    try {
      const { payload } = await jwtVerify(token, SECRET, {
        issuer: ISSUER,
        audience: RESOURCE,
      });
      return {
        token,
        clientId: String(payload.sub),
        scopes: (typeof payload.scope === 'string' ? payload.scope : '')
          .split(' ')
          .filter(Boolean),
        expiresAt: payload.exp,
      };
    } catch {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid JWT');
    }
  }
}

/** Narrows scopes by a tenant header; refuses an unknown tenant. */
@Injectable()
class TenantAuthorizer implements McpAuthorizer {
  authorize(request: AuthenticatedRequest, auth: AuthInfo): AuthInfo {
    const tenant = request.headers['x-tenant'];
    if (tenant === undefined) return auth;
    if (tenant === 'blocked') {
      throw new McpAccessDeniedError('Not a member of this tenant');
    }
    if (tenant === 'readonly') {
      return {
        ...auth,
        scopes: auth.scopes.filter((scope) => scope.endsWith(':read')),
        extra: { ...auth.extra, tenant },
      };
    }
    return { ...auth, extra: { ...auth.extra, tenant } };
  }
}

@Resolver('notes')
export class NotesResolver {
  @Tool({ name: 'whoami', description: 'Returns the caller' })
  whoami(ctx: McpContext): CallToolResult {
    const auth = ctx.http?.authInfo;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            clientId: auth?.clientId,
            scopes: auth?.scopes,
            tenant: auth?.extra?.tenant,
          }),
        },
      ],
    };
  }

  @Tool({
    name: 'list_notes',
    description: 'Lists notes',
    scopes: ['notes:read'],
  })
  listNotes(): CallToolResult {
    return { content: [{ type: 'text', text: '[]' }] };
  }

  @Tool({
    name: 'add_note',
    description: 'Adds a note',
    paramsSchema: z.object({ text: z.string() }),
    scopes: ['notes:write'],
  })
  addNote(params: { text: string }): CallToolResult {
    return { content: [{ type: 'text', text: `added ${params.text}` }] };
  }
}

export const createApp = async (
  hideOutOfScope: boolean,
): Promise<{ app: INestApplication; baseUrl: string }> => {
  @Module({
    imports: [
      McpModule.forRoot({
        name: 'auth-e2e',
        version: '1.0.0',
        logging: { enabled: false },
        auth: {
          strategies: [ApiKeyStrategy, JwtStrategy],
          authorizers: [TenantAuthorizer],
          hideOutOfScope,
          protectedResource: {
            resource: RESOURCE,
            authorizationServers: [AUTHORIZATION_SERVER],
            scopesSupported: ['notes:read', 'notes:write'],
            resourceName: 'Notes',
          },
        },
      }),
    ],
    providers: [ApiKeyStrategy, JwtStrategy, TenantAuthorizer, NotesResolver],
  })
  class AuthTestModule {}

  return listen(AuthTestModule);
};

/** Boots `module` on an ephemeral port. */
export const listen = async (
  module: unknown,
): Promise<{ app: INestApplication; baseUrl: string }> => {
  const fixture = await Test.createTestingModule({
    imports: [module as never],
  }).compile();
  const app = fixture.createNestApplication({ logger: false });
  await app.listen(0);
  const server = app.getHttpServer() as Server;
  const baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  return { app, baseUrl };
};

export interface JsonRpcBody {
  result?: {
    tools?: { name: string }[];
    content?: { type: string; text: string }[];
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

export const modernCall = async (
  baseUrl: string,
  method: string,
  params: { name?: string; arguments?: Record<string, unknown> } = {},
  headers: Record<string, string> = {},
): Promise<Response> =>
  fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': method,
      'Mcp-Name': params.name ?? '',
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: { ...params, _meta: ENVELOPE },
    }),
  });

export const mintJwt = (scope: string, audience = RESOURCE): Promise<string> =>
  new SignJWT({ scope })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('jwt-user')
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setExpirationTime('5m')
    .sign(SECRET);
