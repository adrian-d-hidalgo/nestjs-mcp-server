import { McpServer } from '@modelcontextprotocol/server';
import { ModuleRef, Reflector } from '@nestjs/core';

import {
  MCP_PROMPT,
  MCP_RESOURCE,
  MCP_TOOL,
  Resolver,
  Tool,
} from '../decorators';
import type { McpRegistrationContext } from '../interfaces/registration-context.interface';
import type { McpAuthOptions } from '../mcp.types';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { markPublicOnly } from './capability-scopes';
import { RegistryService } from './registry.service';

describe('RegistryService', () => {
  const contextWith = (scopes?: string[]): McpRegistrationContext =>
    ({
      request: { headers: {} },
      era: 'modern',
      ...(scopes ? { authInfo: { token: 't', clientId: 'c', scopes } } : {}),
    }) as unknown as McpRegistrationContext;

  /**
   * Per-capability `scopes`: the library-built SDK `scopeChallenge`, and
   * `auth.hideOutOfScope` / anonymous handling at registration. The SDK's own
   * evaluation of the challenge is covered by `test/auth.e2e-spec.ts`.
   */
  describe('capability scopes', () => {
    type Challenge = (ctx: { authInfo?: { scopes: string[] } }) => unknown;

    const createHandle = () => ({ enabled: true, disable: jest.fn() });

    const build = (
      metadata: Record<string, unknown>,
      authOptions?: McpAuthOptions,
    ) => {
      const method = {
        metadata,
        instance: { constructor: { name: 'ScopedResolver' } },
        handler: jest.fn(),
      };
      const discovery = {
        getAllMethodsWithMetadata: jest.fn((key: string) =>
          key ===
          (metadata.uri
            ? MCP_RESOURCE
            : metadata.prompt
              ? MCP_PROMPT
              : MCP_TOOL)
            ? [method]
            : [],
        ),
      };
      const logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const service = new RegistryService(
        discovery as unknown as DiscoveryService,
        logger as unknown as McpLoggerService,
        new Reflector(),
        { get: jest.fn(), create: jest.fn() } as unknown as ModuleRef,
        authOptions,
      );
      const handle = createHandle();
      const server = {
        registerTool: jest.fn().mockReturnValue(handle),
        registerPrompt: jest.fn().mockReturnValue(handle),
        registerResource: jest.fn().mockReturnValue(handle),
      };
      return { service, server, handle };
    };

    const auth: McpAuthOptions = { strategies: [] };

    it('passes a scopeChallenge that challenges only an unsatisfied grant', async () => {
      const { service, server } = build({ name: 'write', scopes: ['w'] }, auth);

      await service.registerAll(
        server as unknown as McpServer,
        contextWith(['w']),
      );

      const config = (server.registerTool.mock.calls[0] as unknown[])[1] as {
        scopeChallenge: Challenge;
      };
      expect(config.scopeChallenge({ authInfo: { scopes: ['r'] } })).toEqual({
        scopes: ['w'],
      });
      expect(
        config.scopeChallenge({ authInfo: { scopes: ['r', 'w'] } }),
      ).toBeUndefined();
      // No AuthInfo, no challenge: matches the SDK's `requireScopes`.
      expect(config.scopeChallenge({})).toBeUndefined();
    });

    it('passes a scopeChallenge for prompts and resources too', async () => {
      const prompt = build({ name: 'p', prompt: true, scopes: ['a'] }, auth);
      await prompt.service.registerAll(
        prompt.server as unknown as McpServer,
        contextWith(['a']),
      );
      const resource = build({ name: 'r', uri: 'x://r', scopes: ['a'] }, auth);
      await resource.service.registerAll(
        resource.server as unknown as McpServer,
        contextWith(['a']),
      );

      const promptConfig = (
        prompt.server.registerPrompt.mock.calls[0] as unknown[]
      )[1] as {
        scopeChallenge: Challenge;
      };
      const resourceConfig = (
        resource.server.registerResource.mock.calls[0] as unknown[]
      )[2] as { scopeChallenge: Challenge };
      expect(promptConfig.scopeChallenge({ authInfo: { scopes: [] } })).toEqual(
        { scopes: ['a'] },
      );
      expect(
        resourceConfig.scopeChallenge({ authInfo: { scopes: [] } }),
      ).toEqual({ scopes: ['a'] });
    });

    it('uses auth.scopeSatisfies when provided', async () => {
      const { service, server } = build(
        { name: 'write', scopes: ['notes:write'] },
        {
          strategies: [],
          scopeSatisfies: (granted, required) =>
            granted.includes('admin') ||
            required.every((s) => granted.includes(s)),
        },
      );

      await service.registerAll(
        server as unknown as McpServer,
        contextWith(['admin']),
      );

      const config = (server.registerTool.mock.calls[0] as unknown[])[1] as {
        scopeChallenge: Challenge;
      };
      expect(
        config.scopeChallenge({ authInfo: { scopes: ['admin'] } }),
      ).toBeUndefined();
    });

    it('adds no scopeChallenge to a capability without scopes', async () => {
      const { service, server } = build({ name: 'open' }, auth);

      await service.registerAll(
        server as unknown as McpServer,
        contextWith([]),
      );

      expect(
        (server.registerTool.mock.calls[0] as unknown[])[1],
      ).not.toHaveProperty('scopeChallenge');
    });

    it('keeps an out-of-scope capability listed when hideOutOfScope is false', async () => {
      const { service, server, handle } = build(
        { name: 'write', scopes: ['w'] },
        auth,
      );

      await service.registerAll(
        server as unknown as McpServer,
        contextWith(['r']),
      );

      expect(handle.disable).not.toHaveBeenCalled();
    });

    it('disables an out-of-scope capability when hideOutOfScope is true', async () => {
      const { service, server, handle } = build(
        { name: 'write', scopes: ['w'], enabled: false },
        { ...auth, hideOutOfScope: true },
      );

      await service.registerAll(
        server as unknown as McpServer,
        contextWith(['r']),
      );

      // Once, even though `enabled: false` would disable it too.
      expect(handle.disable).toHaveBeenCalledTimes(1);
    });

    it('keeps an in-scope capability when hideOutOfScope is true', async () => {
      const { service, server, handle } = build(
        { name: 'write', scopes: ['w'] },
        { ...auth, hideOutOfScope: true },
      );

      await service.registerAll(
        server as unknown as McpServer,
        contextWith(['w']),
      );

      expect(handle.disable).not.toHaveBeenCalled();
    });

    it('disables a scoped capability for an anonymous request when auth is configured', async () => {
      const { service, server, handle } = build(
        { name: 'write', scopes: ['w'] },
        { ...auth, optional: true },
      );

      await service.registerAll(server as unknown as McpServer, contextWith());

      expect(handle.disable).toHaveBeenCalledTimes(1);
    });

    it('disables the capability when scopeSatisfies throws at registration (fail closed)', async () => {
      const { service, server, handle } = build(
        { name: 'write', scopes: ['w'] },
        {
          ...auth,
          hideOutOfScope: true,
          scopeSatisfies: () => {
            throw new Error('policy store down');
          },
        },
      );

      await service.registerAll(
        server as unknown as McpServer,
        contextWith(['w']),
      );

      expect(handle.disable).toHaveBeenCalledTimes(1);
    });

    it('disables the capability when the grant has no scopes array (fail closed)', async () => {
      const { service, server, handle } = build(
        { name: 'write', scopes: ['w'] },
        auth,
      );
      const context = {
        ...contextWith(),
        authInfo: { token: 't', clientId: 'c', scopes: 'w' },
      } as unknown as McpRegistrationContext;

      await service.registerAll(server as unknown as McpServer, context);

      expect(handle.disable).toHaveBeenCalledTimes(1);
    });

    it('still applies the enabled toggle when the scope check passes', async () => {
      const { service, server, handle } = build(
        { name: 'write', scopes: ['w'], enabled: false },
        { ...auth, hideOutOfScope: true },
      );

      await service.registerAll(
        server as unknown as McpServer,
        contextWith(['w']),
      );

      expect(handle.disable).toHaveBeenCalledTimes(1);
    });

    it('challenges when scopeSatisfies throws or the grant has no scopes array', async () => {
      const throwing = build(
        { name: 'write', scopes: ['w'] },
        {
          ...auth,
          scopeSatisfies: () => {
            throw new Error('boom');
          },
        },
      );
      await throwing.service.registerAll(
        throwing.server as unknown as McpServer,
        contextWith(['w']),
      );
      const plain = build({ name: 'write', scopes: ['w'] }, auth);
      await plain.service.registerAll(
        plain.server as unknown as McpServer,
        contextWith(['w']),
      );

      const challengeOf = (server: { registerTool: jest.Mock }) =>
        (
          (server.registerTool.mock.calls[0] as unknown[])[1] as {
            scopeChallenge: (ctx: unknown) => unknown;
          }
        ).scopeChallenge;
      expect(
        challengeOf(throwing.server)({ authInfo: { scopes: ['w'] } }),
      ).toEqual({ scopes: ['w'] });
      expect(challengeOf(plain.server)({ authInfo: { scopes: 'w' } })).toEqual({
        scopes: ['w'],
      });
    });

    it('leaves a scoped capability alone when auth is not configured', async () => {
      const { service, server, handle } = build({
        name: 'write',
        scopes: ['w'],
      });

      await service.registerAll(server as unknown as McpServer, contextWith());

      expect(handle.disable).not.toHaveBeenCalled();
    });
  });

  /**
   * `@Resolver({ scopes, public, hideOutOfScope })` defaults, merged under
   * each capability's own options (capability > resolver > module).
   */
  describe('resolver access defaults', () => {
    @Resolver({ name: 'notes', scopes: ['notes:read'] })
    class ScopedResolver {
      @Tool({ name: 'inherits' })
      inherits() {}

      @Tool({ name: 'replaces', scopes: ['notes:write'] })
      replaces() {}

      @Tool({ name: 'opens', public: true })
      opens() {}
    }

    @Resolver({ public: true })
    class PublicResolver {
      @Tool({ name: 'open' })
      open() {}

      @Tool({ name: 'closed', scopes: ['admin'] })
      closed() {}
    }

    @Resolver({ scopes: ['w'], hideOutOfScope: false })
    class ShownResolver {
      @Tool({ name: 'shown' })
      shown() {}

      @Tool({ name: 'hidden', hideOutOfScope: true })
      hidden() {}
    }

    @Resolver('plain')
    class PlainResolver {
      @Tool({ name: 'plain', scopes: ['w'] })
      plain() {}
    }

    const toolsOf = (Class: new () => object) => {
      const instance = new Class();
      const proto = Class.prototype as Record<string, object>;
      return Object.getOwnPropertyNames(proto)
        .filter((key) => key !== 'constructor')
        .map((key) => ({
          metadata: Reflect.getMetadata(MCP_TOOL, proto[key]) as Record<
            string,
            unknown
          >,
          instance,
          handler: jest.fn(),
        }));
    };

    const register = async (
      Class: new () => object,
      authOptions: McpAuthOptions | undefined,
      scopes?: string[],
      context = contextWith(scopes),
      disable: () => void = () => {},
    ) => {
      const methods = toolsOf(Class);
      const handles = new Map<string, { disable: jest.Mock }>();
      const configs = new Map<string, { scopeChallenge?: Challenge }>();
      const server = {
        registerTool: jest.fn((name: string, config: object) => {
          const handle = { enabled: true, disable: jest.fn(disable) };
          handles.set(name, handle);
          configs.set(name, config);
          return handle;
        }),
        registerPrompt: jest.fn(),
        registerResource: jest.fn(),
      };
      const service = new RegistryService(
        {
          getAllMethodsWithMetadata: jest.fn((key: string) =>
            key === MCP_TOOL ? methods : [],
          ),
        } as unknown as DiscoveryService,
        {
          log: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        } as unknown as McpLoggerService,
        new Reflector(),
        { get: jest.fn(), create: jest.fn() } as unknown as ModuleRef,
        authOptions,
      );
      await service.registerAll(server as unknown as McpServer, context);
      return { handles, configs };
    };

    type Challenge = (ctx: { authInfo?: { scopes: string[] } }) => unknown;
    const auth: McpAuthOptions = { strategies: [] };

    it('applies the resolver scopes to a capability declaring none', async () => {
      const { configs } = await register(ScopedResolver, auth, []);

      expect(
        configs.get('inherits')?.scopeChallenge?.({ authInfo: { scopes: [] } }),
      ).toEqual({ scopes: ['notes:read'] });
    });

    it("replaces the resolver scopes with the capability's own", async () => {
      const { configs } = await register(ScopedResolver, auth, []);
      const challenge = configs.get('replaces')?.scopeChallenge;

      expect(challenge?.({ authInfo: { scopes: ['notes:write'] } })).toBe(
        undefined,
      );
      expect(challenge?.({ authInfo: { scopes: ['notes:read'] } })).toEqual({
        scopes: ['notes:write'],
      });
    });

    it('drops the resolver scopes from a public capability', async () => {
      const { configs } = await register(ScopedResolver, auth, []);

      expect(configs.get('opens')).not.toHaveProperty('scopeChallenge');
    });

    it('makes capabilities public from the resolver, unless they declare scopes', async () => {
      const { configs } = await register(PublicResolver, auth, []);

      expect(configs.get('open')).not.toHaveProperty('scopeChallenge');
      expect(
        configs.get('closed')?.scopeChallenge?.({ authInfo: { scopes: [] } }),
      ).toEqual({ scopes: ['admin'] });
    });

    it('lets capability > resolver > module decide hideOutOfScope', async () => {
      const { handles } = await register(
        ShownResolver,
        { ...auth, hideOutOfScope: true },
        ['r'],
      );

      // Resolver `false` beats module `true`; capability `true` beats both.
      expect(handles.get('shown')?.disable).not.toHaveBeenCalled();
      expect(handles.get('hidden')?.disable).toHaveBeenCalledTimes(1);
    });

    describe('for a request admitted for public capabilities only', () => {
      const publicOnly = () => {
        const context = contextWith();
        markPublicOnly(context.request);
        return context;
      };

      it('disables every non-public capability and keeps public ones', async () => {
        const scoped = await register(
          ScopedResolver,
          auth,
          undefined,
          publicOnly(),
        );
        const open = await register(
          PublicResolver,
          auth,
          undefined,
          publicOnly(),
        );

        expect(scoped.handles.get('opens')?.disable).not.toHaveBeenCalled();
        expect(scoped.handles.get('inherits')?.disable).toHaveBeenCalledTimes(
          1,
        );
        expect(scoped.handles.get('replaces')?.disable).toHaveBeenCalledTimes(
          1,
        );
        expect(open.handles.get('open')?.disable).not.toHaveBeenCalled();
        expect(open.handles.get('closed')?.disable).toHaveBeenCalledTimes(1);
      });

      @Resolver('mixed')
      class MixedResolver {
        @Tool({ name: 'unscoped' })
        unscoped() {}

        @Tool({ name: 'open', public: true })
        open() {}
      }

      it('disables an unscoped non-public capability too', async () => {
        const { handles } = await register(
          MixedResolver,
          auth,
          undefined,
          publicOnly(),
        );

        expect(handles.get('unscoped')?.disable).toHaveBeenCalledTimes(1);
        expect(handles.get('open')?.disable).not.toHaveBeenCalled();
      });

      it('fails the request when a non-public capability cannot be disabled', async () => {
        // Leaving it enabled would expose it to a caller no strategy accepted.
        await expect(
          register(MixedResolver, auth, undefined, publicOnly(), () => {
            throw new Error('sdk exploded');
          }),
        ).rejects.toThrow(/sdk exploded/);
      });

      it('leaves an unmarked anonymous request as before', async () => {
        const { handles } = await register(MixedResolver, auth);

        expect(handles.get('unscoped')?.disable).not.toHaveBeenCalled();
      });
    });

    it('keeps the string form exactly as before', async () => {
      const shown = await register(PlainResolver, auth, ['r']);
      const hidden = await register(
        PlainResolver,
        { ...auth, hideOutOfScope: true },
        ['r'],
      );

      expect(shown.handles.get('plain')?.disable).not.toHaveBeenCalled();
      expect(hidden.handles.get('plain')?.disable).toHaveBeenCalledTimes(1);
    });
  });
});
