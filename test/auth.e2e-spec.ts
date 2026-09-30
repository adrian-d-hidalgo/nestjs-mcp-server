import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { INestApplication } from '@nestjs/common';

import { CallToolResult, OAuthProtectedResourceMetadata } from '../src';
import {
  API_KEY,
  AUTHORIZATION_SERVER,
  createApp,
  JsonRpcBody,
  mintJwt,
  modernCall,
  PRM_PATH,
  PRM_URL,
  RATE_LIMITED_KEY,
  RESOURCE,
} from './support/auth';

/**
 * Pluggable authentication (Layer 1) and request authorization (Layer 2a/2b)
 * through a real HTTP server, exactly as a consumer wires them: strategies,
 * challenges, authorizers and per-capability scopes. Module-level options
 * (`optional`, `forRootAsync`) and `examples/auth` are covered by
 * `auth-options.e2e-spec.ts`.
 */

describe('Authentication & authorization (e2e)', () => {
  describe('with hideOutOfScope: false', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
      ({ app, baseUrl } = await createApp(false));
    });

    afterAll(async () => {
      await app.close();
    });

    it('answers 401 with a resource_metadata challenge when no credentials are sent', async () => {
      const response = await modernCall(baseUrl, 'tools/list');

      expect(response.status).toBe(401);
      const challenge = response.headers.get('www-authenticate') ?? '';
      expect(challenge).toMatch(/^Bearer /);
      expect(challenge).toContain(`resource_metadata="${PRM_URL}"`);
      expect(challenge).toContain('scope="notes:read notes:write"');
      // RFC 6750 §3.1: no error code when the request carried no credentials.
      expect(challenge).not.toContain('error=');
    });

    it('advertises every registered method in the 401 challenge, not only Bearer', async () => {
      const response = await modernCall(baseUrl, 'tools/list');

      const challenge = response.headers.get('www-authenticate') ?? '';
      expect(challenge).toContain('ApiKey header="x-api-key"');
    });

    it('answers a rejected non-OAuth credential with a generic 401 and that method challenge', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        { 'x-api-key': 'not-a-real-key' },
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: 'unauthorized',
        error_description: 'Unknown API key',
      });
      const challenge = response.headers.get('www-authenticate') ?? '';
      expect(challenge).toContain('ApiKey header="x-api-key"');
      expect(challenge).not.toContain('invalid_token');
    });

    it('authenticates with the API-key strategy', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/call',
        { name: 'whoami', arguments: {} },
        { 'x-api-key': API_KEY },
      );
      const body = (await response.json()) as JsonRpcBody;

      expect(response.status).toBe(200);
      expect(body.result?.content?.[0]?.text).toContain('api-key-client');
    });

    it('authenticates with the JWT strategy', async () => {
      const token = await mintJwt('notes:read');
      const response = await modernCall(
        baseUrl,
        'tools/call',
        { name: 'whoami', arguments: {} },
        { authorization: `Bearer ${token}` },
      );
      const body = (await response.json()) as JsonRpcBody;

      expect(response.status).toBe(200);
      expect(body.result?.content?.[0]?.text).toContain('jwt-user');
    });

    it('answers 401 invalid_token for a token the strategy rejects', async () => {
      const token = await mintJwt('notes:read', 'https://other.example.com');
      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        {
          authorization: `Bearer ${token}`,
        },
      );

      expect(response.status).toBe(401);
      const challenge = response.headers.get('www-authenticate') ?? '';
      expect(challenge).toContain('error="invalid_token"');
      expect(challenge).toContain(`resource_metadata="${PRM_URL}"`);
    });

    it('answers 403 access_denied when an authorizer refuses the caller', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        {
          'x-api-key': API_KEY,
          'x-tenant': 'blocked',
        },
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: 'access_denied',
        error_description: 'Not a member of this tenant',
      });
    });

    it('passes the authorizer-enriched identity to handlers', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/call',
        { name: 'whoami', arguments: {} },
        { 'x-api-key': API_KEY, 'x-tenant': 'readonly' },
      );
      const body = (await response.json()) as JsonRpcBody;
      const caller = JSON.parse(body.result?.content?.[0]?.text ?? '{}') as {
        scopes: string[];
        tenant: string;
      };

      expect(caller).toEqual(
        expect.objectContaining({ scopes: ['notes:read'], tenant: 'readonly' }),
      );
    });

    it('answers 403 insufficient_scope when a narrowed caller calls a write tool', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/call',
        { name: 'add_note', arguments: { text: 'x' } },
        { 'x-api-key': API_KEY, 'x-tenant': 'readonly' },
      );

      expect(response.status).toBe(403);
      const challenge = response.headers.get('www-authenticate') ?? '';
      expect(challenge).toContain('error="insufficient_scope"');
      expect(challenge).toContain('scope="notes:write"');
      expect(challenge).toContain(`resource_metadata="${PRM_URL}"`);
    });

    it('lists out-of-scope tools when hideOutOfScope is false', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        {
          'x-api-key': API_KEY,
          'x-tenant': 'readonly',
        },
      );
      const body = (await response.json()) as JsonRpcBody;

      expect(body.result?.tools?.map((t) => t.name)).toContain('add_note');
    });

    it('writes an McpHttpError thrown by a strategy as-is', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        {
          'x-api-key': RATE_LIMITED_KEY,
        },
      );

      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('30');
      expect(await response.json()).toEqual({ error: 'too_many_requests' });
    });

    it('serves the Protected Resource Metadata document', async () => {
      const response = await fetch(`${baseUrl}${PRM_PATH}`);
      const metadata =
        (await response.json()) as OAuthProtectedResourceMetadata;

      expect(response.status).toBe(200);
      expect(metadata).toEqual({
        resource: RESOURCE,
        authorization_servers: [AUTHORIZATION_SERVER],
        scopes_supported: ['notes:read', 'notes:write'],
        resource_name: 'Notes',
      });
    });

    it('serves the Protected Resource Metadata document at the trailing-slash path too', async () => {
      const response = await fetch(`${baseUrl}${PRM_PATH}/`);

      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as OAuthProtectedResourceMetadata).resource,
      ).toBe(RESOURCE);
    });

    it('answers 404 for a Protected Resource Metadata path of another resource', async () => {
      const other = await fetch(
        `${baseUrl}/.well-known/oauth-protected-resource/other`,
      );
      const root = await fetch(
        `${baseUrl}/.well-known/oauth-protected-resource`,
      );

      expect(other.status).toBe(404);
      expect(root.status).toBe(404);
    });

    it('lets an authenticated SDK v1 client (2025 era) through', async () => {
      const client = new Client({ name: 'v1-client', version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/mcp`),
        { requestInit: { headers: { 'x-api-key': API_KEY } } },
      );

      try {
        await client.connect(transport);
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toContain('list_notes');

        const result = (await client.callTool({
          name: 'whoami',
          arguments: {},
        })) as CallToolResult;
        expect(JSON.stringify(result.content)).toContain('api-key-client');
      } finally {
        await transport.close();
      }
    });

    it('refuses an unauthenticated SDK v1 client', async () => {
      const client = new Client({ name: 'v1-client', version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/mcp`),
      );

      try {
        await expect(client.connect(transport)).rejects.toThrow();
      } finally {
        await transport.close();
      }
    });
  });

  describe('with hideOutOfScope: true', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
      ({ app, baseUrl } = await createApp(true));
    });

    afterAll(async () => {
      await app.close();
    });

    const narrowed = { 'x-api-key': API_KEY, 'x-tenant': 'readonly' };

    it('omits out-of-scope tools from tools/list', async () => {
      const response = await modernCall(baseUrl, 'tools/list', {}, narrowed);
      const body = (await response.json()) as JsonRpcBody;
      const names = body.result?.tools?.map((t) => t.name);

      expect(names).toContain('list_notes');
      expect(names).not.toContain('add_note');
    });

    it('answers a direct call to an out-of-scope tool with "disabled"', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/call',
        { name: 'add_note', arguments: { text: 'x' } },
        narrowed,
      );
      const body = (await response.json()) as JsonRpcBody;

      expect(response.status).toBe(200);
      expect(JSON.stringify(body)).toMatch(/disabled/i);
    });

    it('still lists every tool for a caller holding all scopes', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        {
          'x-api-key': API_KEY,
        },
      );
      const body = (await response.json()) as JsonRpcBody;

      expect(body.result?.tools?.map((t) => t.name)).toEqual(
        expect.arrayContaining(['whoami', 'list_notes', 'add_note']),
      );
    });
  });
});
