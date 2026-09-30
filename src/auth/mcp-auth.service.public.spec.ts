import type { AuthenticatedRequest } from '../interfaces/handler-context.interface';
import type { McpAuthOptions } from '../mcp.types';
import { Resolver, Tool } from '../decorators';
import { isPublicOnly } from '../services/capability-scopes';
import { discoveryOver } from '../services/registry.service.test-helpers';
import { McpAuthService } from './mcp-auth.service';
import {
  buildAuthService,
  createResponse,
  info,
  PRM_URL,
  RESOURCE,
  strategy,
} from './mcp-auth.service.test-helpers';

describe('McpAuthService', () => {
  const build = async (
    ...args: Parameters<typeof buildAuthService>
  ): Promise<McpAuthService> => (await buildAuthService(...args)).service;

  describe('public capabilities', () => {
    @Resolver('catalog')
    class CatalogResolver {
      @Tool({ name: 'search', public: true })
      search() {}

      @Tool({ name: 'delete_all' })
      deleteAll() {}
    }

    @Resolver('closed')
    class ClosedResolver {
      @Tool({ name: 'closed_tool' })
      closedTool() {}
    }

    const withBody = (body: unknown): AuthenticatedRequest =>
      ({ headers: {}, method: 'POST', body }) as AuthenticatedRequest;

    const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize' };
    const callTool = (name: string) => ({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name },
    });

    const buildWith = (
      options: Partial<McpAuthOptions>,
      ...classes: (new () => object)[]
    ) => {
      const none = strategy(() => null);
      return build(
        { strategies: [none.Class], ...options },
        [none.Class],
        discoveryOver(...classes),
      );
    };

    it('answers 401 as before when no capability is public', async () => {
      const service = await buildWith({}, ClosedResolver);
      const { res, written } = createResponse();

      await expect(
        service.authenticate(withBody(initialize), res),
      ).resolves.toBe(false);
      expect(written.status).toBe(401);
    });

    it.each([
      ['a handshake', initialize],
      ['a public tool call', callTool('search')],
    ])('serves %s anonymously, marked public-only', async (_label, body) => {
      const service = await buildWith({}, CatalogResolver);
      const req = withBody(body);
      req.auth = info(); // set upstream: never passes for an identity
      const { res, raw } = createResponse();

      await expect(service.authenticate(req, res)).resolves.toBe(true);
      expect(req.auth).toBeUndefined();
      expect(isPublicOnly(req)).toBe(true);
      expect(raw.writeHead).not.toHaveBeenCalled();
    });

    it('answers 401 with the challenges to an anonymous call of a protected tool', async () => {
      const service = await buildWith(
        { protectedResource: { resource: RESOURCE, authorizationServers: [] } },
        CatalogResolver,
      );
      const req = withBody(callTool('delete_all'));
      const { res, written } = createResponse();

      await expect(service.authenticate(req, res)).resolves.toBe(false);
      expect(written.status).toBe(401);
      expect(written.headers['www-authenticate']).toContain(
        `resource_metadata="${PRM_URL}"`,
      );
      expect(isPublicOnly(req)).toBe(false);
    });

    it('leaves optional and authenticated requests unmarked', async () => {
      const optional = await buildWith({ optional: true }, CatalogResolver);
      const anonymous = withBody(callTool('delete_all'));
      await expect(
        optional.authenticate(anonymous, createResponse().res),
      ).resolves.toBe(true);

      const known = strategy(() => info());
      const authenticated = await build(
        { strategies: [known.Class] },
        [known.Class],
        discoveryOver(CatalogResolver),
      );
      const caller = withBody(callTool('delete_all'));
      await expect(
        authenticated.authenticate(caller, createResponse().res),
      ).resolves.toBe(true);

      expect(isPublicOnly(anonymous)).toBe(false);
      expect(isPublicOnly(caller)).toBe(false);
      expect(caller.auth).toEqual(info());
    });
  });
});
