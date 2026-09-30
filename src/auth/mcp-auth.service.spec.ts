import type { AuthInfo } from '@modelcontextprotocol/server';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import { Injectable } from '@nestjs/common';

import type { AuthenticatedRequest } from '../interfaces/handler-context.interface';
import {
  McpAccessDeniedError,
  McpHttpError,
  McpUnauthorizedError,
} from './auth.errors';
import type { McpAuthStrategy } from './auth-strategy.interface';
import { McpAuthService } from './mcp-auth.service';
import {
  authorizer,
  buildAuthService,
  createRequest,
  createResponse,
  info,
  PRM_URL,
  RESOURCE,
  strategy,
  TestLogger,
} from './mcp-auth.service.test-helpers';

describe('McpAuthService', () => {
  let logger: TestLogger;

  const build = async (
    ...args: Parameters<typeof buildAuthService>
  ): Promise<McpAuthService> => {
    const built = await buildAuthService(...args);
    logger = built.logger;
    return built.service;
  };

  describe('without auth options', () => {
    it('is disabled and lets every request through untouched', async () => {
      const service = await build(undefined);
      const req = createRequest();
      const { res, raw } = createResponse();

      expect(service.enabled).toBe(false);
      await expect(service.authenticate(req, res)).resolves.toBe(true);
      expect(req.auth).toBeUndefined();
      expect(raw.writeHead).not.toHaveBeenCalled();
    });
  });

  describe('boot', () => {
    it('fails when a strategy cannot be resolved from the container', async () => {
      const { Class } = strategy(() => null);

      await expect(build({ strategies: [Class] }, [])).rejects.toThrow(
        /strategy TestStrategy could not be resolved/,
      );
    });

    it('fails when an authorizer cannot be resolved from the container', async () => {
      const { Class } = strategy(() => null);
      const Authorizer = authorizer((auth) => auth);

      await expect(
        build({ strategies: [Class], authorizers: [Authorizer] }, [Class]),
      ).rejects.toThrow(/authorizer TestAuthorizer could not be resolved/);
    });

    it('fails on a protectedResource that is not a URL', async () => {
      const { Class } = strategy(() => null);

      await expect(
        build({
          strategies: [Class],
          protectedResource: {
            resource: 'not a url',
            authorizationServers: [],
          },
        }),
      ).rejects.toThrow();
    });
    it.each([
      ['a space', ['notes:read notes:write']],
      ['a quote', ['notes"read']],
      ['a control character', ['notes\nread']],
      ['an empty scope', ['']],
    ])(
      'fails when protectedResource.scopesSupported holds %s',
      async (_label, scopesSupported) => {
        const { Class } = strategy(() => null);

        await expect(
          build({
            strategies: [Class],
            protectedResource: {
              resource: RESOURCE,
              authorizationServers: [],
              scopesSupported,
            },
          }),
        ).rejects.toThrow(/scopesSupported.*scope-token/);
      },
    );

    it.each([
      ['a line break', 'ApiKey header="x"\r\nX-Injected: 1'],
      ['an unterminated quoted-string', 'ApiKey header="x'],
      ['no auth-scheme', '="x"'],
      ['an empty string', ''],
    ])('fails when a strategy challenge has %s', async (_label, challenge) => {
      @Injectable()
      class BadChallengeStrategy implements McpAuthStrategy {
        readonly challenge = challenge;
        authenticate() {
          return null;
        }
      }

      await expect(
        build({ strategies: [BadChallengeStrategy] }),
      ).rejects.toThrow(/BadChallengeStrategy\.challenge/);
    });

    it.each([
      'ApiKey header="x-api-key"',
      'Basic realm="demo", charset="UTF-8"',
      'Negotiate',
      'Custom abc123==',
    ])('accepts the strategy challenge %s', async (challenge) => {
      @Injectable()
      class GoodChallengeStrategy implements McpAuthStrategy {
        readonly challenge = challenge;
        authenticate() {
          return null;
        }
      }

      await expect(
        build({ strategies: [GoodChallengeStrategy] }),
      ).resolves.toBeInstanceOf(McpAuthService);
    });
  });

  describe('strategies', () => {
    it('runs strategies in order and stops at the first AuthInfo', async () => {
      const first = strategy(() => null);
      const second = strategy(() => info({ clientId: 'second' }));
      const third = strategy(() => info({ clientId: 'third' }));
      const service = await build({
        strategies: [first.Class, second.Class, third.Class],
      });
      const req = createRequest();

      await expect(
        service.authenticate(req, createResponse().res),
      ).resolves.toBe(true);

      expect(first.calls).toHaveBeenCalledTimes(1);
      expect(second.calls).toHaveBeenCalledTimes(1);
      expect(third.calls).not.toHaveBeenCalled();
      expect(req.auth?.clientId).toBe('second');
    });

    it('stamps resourceMetadataUrl onto req.auth unless the strategy set one', async () => {
      const stamped = strategy(() => info());
      const service = await build({
        strategies: [stamped.Class],
        protectedResource: { resource: RESOURCE, authorizationServers: [] },
      });
      const req = createRequest();

      await service.authenticate(req, createResponse().res);
      expect(req.auth?.resourceMetadataUrl).toBe(PRM_URL);

      const own = strategy(() =>
        info({ resourceMetadataUrl: 'https://own.example.com/prm' }),
      );
      const ownService = await build({
        strategies: [own.Class],
        protectedResource: { resource: RESOURCE, authorizationServers: [] },
      });
      const ownReq = createRequest();
      await ownService.authenticate(ownReq, createResponse().res);
      expect(ownReq.auth?.resourceMetadataUrl).toBe(
        'https://own.example.com/prm',
      );
    });

    it('answers 401 without an error code when no strategy recognized the caller', async () => {
      const none = strategy(() => null);
      const service = await build({
        strategies: [none.Class],
        protectedResource: {
          resource: RESOURCE,
          authorizationServers: ['https://as.example.com'],
          scopesSupported: ['read', 'write'],
        },
      });
      const { res, written } = createResponse();

      await expect(service.authenticate(createRequest(), res)).resolves.toBe(
        false,
      );

      expect(written.status).toBe(401);
      expect(written.headers['www-authenticate']).toBe(
        `Bearer scope="read write", resource_metadata="${PRM_URL}"`,
      );
    });

    it('answers a bare Bearer challenge when no protectedResource is configured', async () => {
      const none = strategy(() => null);
      const service = await build({ strategies: [none.Class] });
      const { res, written } = createResponse();

      await service.authenticate(createRequest(), res);

      expect(written.status).toBe(401);
      expect(written.headers['www-authenticate']).toBe('Bearer');
    });

    it("answers only the strategies' own challenges when OAuth discovery is not configured", async () => {
      @Injectable()
      class HeaderKeyStrategy implements McpAuthStrategy {
        readonly challenge = 'ApiKey header="x-key"';
        authenticate() {
          return null;
        }
      }
      @Injectable()
      class BasicStrategy implements McpAuthStrategy {
        readonly challenge = 'Basic realm="demo"';
        authenticate() {
          return null;
        }
      }
      const service = await build({
        strategies: [HeaderKeyStrategy, BasicStrategy],
      });
      const { res, written } = createResponse();

      await service.authenticate(createRequest(), res);

      expect(written.status).toBe(401);
      expect(written.headers['www-authenticate']).toBe(
        'ApiKey header="x-key", Basic realm="demo"',
      );
    });

    it('lists the Bearer challenge first, then strategy challenges, when protectedResource is set', async () => {
      @Injectable()
      class HeaderKeyStrategy implements McpAuthStrategy {
        readonly challenge = 'ApiKey header="x-key"';
        authenticate() {
          return null;
        }
      }
      const service = await build({
        strategies: [HeaderKeyStrategy],
        protectedResource: { resource: RESOURCE, authorizationServers: [] },
      });
      const { res, written } = createResponse();

      await service.authenticate(createRequest(), res);

      expect(written.headers['www-authenticate']).toBe(
        `Bearer resource_metadata="${PRM_URL}", ApiKey header="x-key"`,
      );
    });

    it('answers McpUnauthorizedError with the module challenges, or its own when given', async () => {
      @Injectable()
      class HeaderKeyStrategy implements McpAuthStrategy {
        readonly challenge = 'ApiKey header="x-key"';
        authenticate(request: AuthenticatedRequest): AuthInfo | null {
          if (request.headers['x-key'] === 'custom') {
            throw new McpUnauthorizedError(
              'Expired key',
              'ApiKey error="expired"',
            );
          }
          throw new McpUnauthorizedError('Unknown key');
        }
      }
      const service = await build({ strategies: [HeaderKeyStrategy] });

      const unknown = createResponse();
      await service.authenticate(
        createRequest({ 'x-key': 'nope' }),
        unknown.res,
      );
      expect(unknown.written.status).toBe(401);
      expect(unknown.written.headers['www-authenticate']).toBe(
        'ApiKey header="x-key"',
      );
      expect(JSON.parse(unknown.written.body ?? '{}')).toEqual({
        error: 'unauthorized',
        error_description: 'Unknown key',
      });

      const custom = createResponse();
      await service.authenticate(
        createRequest({ 'x-key': 'custom' }),
        custom.res,
      );
      expect(custom.written.headers['www-authenticate']).toBe(
        'ApiKey error="expired"',
      );
    });

    it('lets an anonymous request through when optional', async () => {
      const none = strategy(() => null);
      const service = await build({ strategies: [none.Class], optional: true });
      const req = createRequest();
      const { res, raw } = createResponse();

      await expect(service.authenticate(req, res)).resolves.toBe(true);
      expect(req.auth).toBeUndefined();
      expect(raw.writeHead).not.toHaveBeenCalled();
    });

    it('drops an upstream req.auth when optional lets an anonymous request through', async () => {
      const none = strategy(() => null);
      const service = await build({ strategies: [none.Class], optional: true });
      const req = createRequest();
      req.auth = info({ clientId: 'set-upstream' });

      await expect(
        service.authenticate(req, createResponse().res),
      ).resolves.toBe(true);
      expect(req.auth).toBeUndefined();
    });

    it('stops at a strategy throwing invalid_token and answers 401 with the challenge', async () => {
      const bad = strategy(() => {
        throw new OAuthError(OAuthErrorCode.InvalidToken, 'Bad key');
      });
      const never = strategy(() => info());
      const service = await build({
        strategies: [bad.Class, never.Class],
        protectedResource: { resource: RESOURCE, authorizationServers: [] },
      });
      const { res, written } = createResponse();

      await expect(service.authenticate(createRequest(), res)).resolves.toBe(
        false,
      );

      expect(never.calls).not.toHaveBeenCalled();
      expect(written.status).toBe(401);
      expect(written.headers['www-authenticate']).toContain(
        'error="invalid_token"',
      );
      expect(written.headers['www-authenticate']).toContain(
        `resource_metadata="${PRM_URL}"`,
      );
      expect(JSON.parse(written.body ?? '{}')).toEqual({
        error: 'invalid_token',
        error_description: 'Bad key',
      });
    });

    it('writes an McpHttpError as-is', async () => {
      const limited = strategy(() => {
        throw new McpHttpError(
          429,
          { error: 'too_many_requests' },
          { 'Retry-After': '30' },
        );
      });
      const service = await build({ strategies: [limited.Class] });
      const { res, written } = createResponse();

      await service.authenticate(createRequest(), res);

      expect(written.status).toBe(429);
      expect(written.headers['retry-after']).toBe('30');
      expect(written.headers['content-type']).toBe('application/json');
      expect(JSON.parse(written.body ?? '{}')).toEqual({
        error: 'too_many_requests',
      });
    });

    it('answers 500 for an unexpected throw and logs no request data', async () => {
      const broken = strategy(() => {
        throw new Error('database down');
      });
      const service = await build({ strategies: [broken.Class] });
      const { res, written } = createResponse();

      await service.authenticate(
        createRequest({ authorization: 'Bearer secret-token' }),
        res,
      );

      expect(written.status).toBe(500);
      expect(JSON.parse(written.body ?? '{}')).toEqual(
        expect.objectContaining({ error: 'server_error' }),
      );
      expect(written.body).not.toContain('database down');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('database down'),
        undefined,
        'auth',
      );
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
        'secret-token',
      );
    });

    it.each([
      ['a non-object', 'token'],
      ['a missing token', { clientId: 'c', scopes: [] }],
      ['a missing clientId', { token: 't', scopes: [] }],
      [
        'scopes that are not an array',
        { token: 't', clientId: 'c', scopes: 'read' },
      ],
      [
        'scopes that are not strings',
        { token: 't', clientId: 'c', scopes: [1] },
      ],
      ['a non-numeric expiresAt', { ...info(), expiresAt: 'soon' }],
    ])(
      'answers 500 when a strategy returns an AuthInfo with %s',
      async (_label, answer) => {
        const broken = strategy(() => answer as unknown as AuthInfo);
        const service = await build({ strategies: [broken.Class] });
        const req = createRequest();
        const { res, written } = createResponse();

        await expect(service.authenticate(req, res)).resolves.toBe(false);
        expect(written.status).toBe(500);
        expect(req.auth).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('TestStrategy.authenticate must return'),
          undefined,
          'auth',
        );
      },
    );

    it('answers 401 invalid_token when a strategy returns an expired AuthInfo', async () => {
      const expired = strategy(() =>
        info({ expiresAt: Math.floor(Date.now() / 1000) - 60 }),
      );
      const service = await build({
        strategies: [expired.Class],
        protectedResource: { resource: RESOURCE, authorizationServers: [] },
      });
      const req = createRequest();
      const { res, written } = createResponse();

      await expect(service.authenticate(req, res)).resolves.toBe(false);
      expect(written.status).toBe(401);
      expect(JSON.parse(written.body ?? '{}')).toEqual(
        expect.objectContaining({ error: 'invalid_token' }),
      );
      expect(written.headers['www-authenticate']).toContain(
        `resource_metadata="${PRM_URL}"`,
      );
      expect(req.auth).toBeUndefined();
    });

    it('answers 500 when a strategy returns expiresAt in milliseconds', async () => {
      const ms = strategy(() => info({ expiresAt: Date.now() + 60_000 }));
      const service = await build({ strategies: [ms.Class] });
      const req = createRequest();
      const { res, written } = createResponse();

      await expect(service.authenticate(req, res)).resolves.toBe(false);
      expect(written.status).toBe(500);
      expect(req.auth).toBeUndefined();
    });

    it('accepts an AuthInfo that has not expired yet', async () => {
      const fresh = strategy(() =>
        info({ expiresAt: Math.floor(Date.now() / 1000) + 60 }),
      );
      const service = await build({ strategies: [fresh.Class] });
      const req = createRequest();
      const { res } = createResponse();

      await expect(service.authenticate(req, res)).resolves.toBe(true);
      expect(req.auth?.clientId).toBe('c');
    });

    it('bypasses authentication for CORS preflight', async () => {
      const never = strategy(() => info());
      const service = await build({ strategies: [never.Class] });
      const { res, raw } = createResponse();

      await expect(
        service.authenticate(createRequest({}, 'OPTIONS'), res),
      ).resolves.toBe(true);
      expect(never.calls).not.toHaveBeenCalled();
      expect(raw.writeHead).not.toHaveBeenCalled();
    });

    it('does not write when the response was already sent', async () => {
      const none = strategy(() => null);
      const service = await build({ strategies: [none.Class] });
      const { res, raw } = createResponse(true);

      await expect(service.authenticate(createRequest(), res)).resolves.toBe(
        false,
      );
      expect(raw.writeHead).not.toHaveBeenCalled();
    });
  });

  describe('authorizers', () => {
    const allScopes = () => strategy(() => info({ scopes: ['read', 'write'] }));

    it('narrows the AuthInfo that reaches req.auth', async () => {
      const auth = allScopes();
      const Narrow = authorizer((current) => ({
        ...current,
        scopes: current.scopes.filter((s) => s === 'read'),
        extra: { tenant: 'acme' },
      }));
      const service = await build({
        strategies: [auth.Class],
        authorizers: [Narrow],
      });
      const req = createRequest();

      await expect(
        service.authenticate(req, createResponse().res),
      ).resolves.toBe(true);
      expect(req.auth?.scopes).toEqual(['read']);
      expect(req.auth?.extra).toEqual({ tenant: 'acme' });
    });

    it('runs authorizers in order, each seeing the previous result', async () => {
      const auth = allScopes();
      const First = authorizer((current) => ({
        ...current,
        scopes: ['read'],
      }));
      const seen = jest.fn();
      const Second = authorizer((current) => {
        seen(current.scopes);
        return current;
      });
      const service = await build({
        strategies: [auth.Class],
        authorizers: [First, Second],
      });

      await service.authenticate(createRequest(), createResponse().res);

      expect(seen).toHaveBeenCalledWith(['read']);
    });

    it('answers 403 access_denied for McpAccessDeniedError', async () => {
      const auth = allScopes();
      const Deny = authorizer(() => {
        throw new McpAccessDeniedError('Not a member');
      });
      const service = await build({
        strategies: [auth.Class],
        authorizers: [Deny],
      });
      const req = createRequest();
      const { res, written } = createResponse();

      await expect(service.authenticate(req, res)).resolves.toBe(false);

      expect(req.auth).toBeUndefined();
      expect(written.status).toBe(403);
      expect(JSON.parse(written.body ?? '{}')).toEqual({
        error: 'access_denied',
        error_description: 'Not a member',
      });
    });

    it('answers a 403 insufficient_scope challenge for OAuthError(InsufficientScope)', async () => {
      const auth = allScopes();
      const StepUp = authorizer(() => {
        throw new OAuthError(OAuthErrorCode.InsufficientScope, 'Need more');
      });
      const service = await build({
        strategies: [auth.Class],
        authorizers: [StepUp],
        protectedResource: { resource: RESOURCE, authorizationServers: [] },
      });
      const { res, written } = createResponse();

      await service.authenticate(createRequest(), res);

      expect(written.status).toBe(403);
      expect(written.headers['www-authenticate']).toContain(
        'error="insufficient_scope"',
      );
      expect(written.headers['www-authenticate']).toContain(
        `resource_metadata="${PRM_URL}"`,
      );
    });

    it('answers 500 when an authorizer returns something other than an AuthInfo', async () => {
      const auth = allScopes();
      const Broken = authorizer(() => undefined as unknown as AuthInfo);
      const service = await build({
        strategies: [auth.Class],
        authorizers: [Broken],
      });
      const { res, written } = createResponse();

      await expect(service.authenticate(createRequest(), res)).resolves.toBe(
        false,
      );
      expect(written.status).toBe(500);
    });

    it('answers 500 when an authorizer returns an AuthInfo without a scopes array', async () => {
      const auth = allScopes();
      const Broken = authorizer(
        (granted) => ({ ...granted, scopes: 'read' }) as unknown as AuthInfo,
      );
      const service = await build({
        strategies: [auth.Class],
        authorizers: [Broken],
      });
      const { res, written } = createResponse();

      await expect(service.authenticate(createRequest(), res)).resolves.toBe(
        false,
      );
      expect(written.status).toBe(500);
    });
  });

  describe('McpHttpError', () => {
    it('sends a string body as text and no body when undefined', async () => {
      const text = new McpHttpError(503, 'down').toResponse();
      const empty = new McpHttpError(204).toResponse();

      expect(text.headers.get('content-type')).toContain('text/plain');
      expect(await text.text()).toBe('down');
      expect(await empty.text()).toBe('');
    });
  });
});
