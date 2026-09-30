import { INestApplication, Module } from '@nestjs/common';
import { SignJWT } from 'jose';

import { McpModule } from '../src';
import {
  API_KEY,
  ApiKeyStrategy,
  AUTHORIZATION_SERVER,
  JsonRpcBody,
  JwtStrategy,
  listen,
  mintJwt,
  modernCall,
  NotesResolver,
  PRM_PATH,
  PRM_URL,
  RESOURCE,
} from './support/auth';

/**
 * Authentication through the module-level options — `optional: true`,
 * `forRootAsync` with `providers` — and the shipped `examples/auth` app.
 * Strategies, challenges, authorizers and scopes: `auth.e2e-spec.ts`.
 */

describe('Authentication & authorization options (e2e)', () => {
  describe('with optional: true', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
      @Module({
        imports: [
          McpModule.forRoot({
            name: 'auth-optional-e2e',
            version: '1.0.0',
            logging: { enabled: false },
            auth: { strategies: [ApiKeyStrategy], optional: true },
          }),
        ],
        providers: [ApiKeyStrategy, NotesResolver],
      })
      class OptionalAuthModule {}

      ({ app, baseUrl } = await listen(OptionalAuthModule));
    });

    afterAll(async () => {
      await app.close();
    });

    it('lists only unscoped tools to an anonymous caller', async () => {
      const response = await modernCall(baseUrl, 'tools/list');
      const body = (await response.json()) as JsonRpcBody;

      expect(response.status).toBe(200);
      expect(body.result?.tools?.map((t) => t.name)).toEqual(['whoami']);
    });

    it('serves an unscoped tool to an anonymous caller', async () => {
      const response = await modernCall(baseUrl, 'tools/call', {
        name: 'whoami',
        arguments: {},
      });
      const body = (await response.json()) as JsonRpcBody;

      expect(response.status).toBe(200);
      expect(body.result?.isError).toBeFalsy();
      expect(body.result?.content?.[0]?.text).toBe('{}');
    });

    it('answers an anonymous call to a scoped tool with "disabled"', async () => {
      const response = await modernCall(baseUrl, 'tools/call', {
        name: 'list_notes',
        arguments: {},
      });
      const body = (await response.json()) as JsonRpcBody;

      expect(response.status).toBe(200);
      expect(JSON.stringify(body)).toMatch(/disabled/i);
    });

    it('still authenticates a caller that sends credentials', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        { 'x-api-key': API_KEY },
      );
      const body = (await response.json()) as JsonRpcBody;

      expect(body.result?.tools?.map((t) => t.name)).toEqual(
        expect.arrayContaining(['whoami', 'list_notes', 'add_note']),
      );
    });

    it('still refuses a wrong credential', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        { 'x-api-key': 'not-a-real-key' },
      );

      expect(response.status).toBe(401);
    });
  });

  describe('with forRootAsync, protectedResourceMetadata and providers', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
      @Module({
        imports: [
          McpModule.forRootAsync({
            // Strategies are declared here, not in the application module.
            providers: [ApiKeyStrategy, JwtStrategy],
            protectedResourceMetadata: true,
            useFactory: () => ({
              name: 'auth-async-e2e',
              version: '1.0.0',
              logging: { enabled: false },
              auth: {
                strategies: [ApiKeyStrategy, JwtStrategy],
                protectedResource: {
                  resource: RESOURCE,
                  authorizationServers: [AUTHORIZATION_SERVER],
                },
              },
            }),
          }),
        ],
        providers: [NotesResolver],
      })
      class AsyncAuthModule {}

      ({ app, baseUrl } = await listen(AsyncAuthModule));
    });

    afterAll(async () => {
      await app.close();
    });

    it('serves the Protected Resource Metadata document', async () => {
      const response = await fetch(`${baseUrl}${PRM_PATH}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        resource: RESOURCE,
        authorization_servers: [AUTHORIZATION_SERVER],
      });
    });

    it('challenges an anonymous request with resource_metadata', async () => {
      const response = await modernCall(baseUrl, 'tools/list');

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain(
        `resource_metadata="${PRM_URL}"`,
      );
    });

    it('resolves the strategies registered through providers', async () => {
      const byKey = await modernCall(
        baseUrl,
        'tools/list',
        {},
        { 'x-api-key': API_KEY },
      );
      const byJwt = await modernCall(
        baseUrl,
        'tools/list',
        {},
        { authorization: `Bearer ${await mintJwt('notes:read')}` },
      );

      expect(byKey.status).toBe(200);
      expect(byJwt.status).toBe(200);
    });
  });

  describe('examples/auth', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
      const { AppModule } = await import('../examples/auth/app.module');
      ({ app, baseUrl } = await listen(AppModule));
    });

    afterAll(async () => {
      await app.close();
    });

    it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty'])(
      'refuses the prototype key %s as an API key with 401',
      async (key) => {
        const response = await modernCall(
          baseUrl,
          'tools/list',
          {},
          { 'x-api-key': key },
        );

        expect(response.status).toBe(401);
      },
    );

    it.each(['toString', 'constructor', '__proto__'])(
      'refuses the prototype key %s as a tenant with 403',
      async (tenant) => {
        const response = await modernCall(
          baseUrl,
          'tools/list',
          {},
          { 'x-api-key': 'demo-read-write-key', 'x-tenant': tenant },
        );

        expect(response.status).toBe(403);
      },
    );

    /** Loads `examples/auth/auth.constants` afresh under `env`. */
    const loadConstants = (env: Record<string, string | undefined>) => {
      const saved = { ...process.env };
      for (const [name, value] of Object.entries(env)) {
        // `process.env` stringifies: `undefined` must be deleted, not assigned.
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      try {
        let loaded: unknown;
        jest.isolateModules(() => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          loaded = require('../examples/auth/auth.constants');
        });
        return loaded;
      } finally {
        process.env = saved;
      }
    };

    it('uses the public demo JWT secret only on loopback outside production', () => {
      expect(() => loadConstants({ JWT_SECRET: undefined })).not.toThrow();
      expect(() =>
        loadConstants({ JWT_SECRET: undefined, NODE_ENV: 'production' }),
      ).toThrow(/JWT_SECRET/);
      expect(() =>
        loadConstants({
          JWT_SECRET: undefined,
          MCP_RESOURCE: 'https://mcp.example.com/mcp',
        }),
      ).toThrow(/JWT_SECRET/);
      expect(() =>
        loadConstants({
          JWT_SECRET: 'a-real-secret-of-at-least-32-bytes!!',
          NODE_ENV: 'production',
          MCP_RESOURCE: 'https://mcp.example.com/mcp',
          JWT_ISSUER: 'https://auth.example.com',
        }),
      ).not.toThrow();
    });

    it('accepts the Bearer scheme case-insensitively', async () => {
      const {
        ISSUER: EXAMPLE_ISSUER,
        JWT_SECRET,
        RESOURCE: EXAMPLE_RESOURCE,
      } = await import('../examples/auth/auth.constants');
      const token = await new SignJWT({ scope: 'notes:read' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('jwt-user')
        .setIssuer(EXAMPLE_ISSUER)
        .setAudience(EXAMPLE_RESOURCE)
        .setExpirationTime('5m')
        .sign(JWT_SECRET);

      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        { authorization: `bearer ${token}` },
      );

      expect(response.status).toBe(200);
    });
  });
});
