import { CanActivate } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { of } from 'rxjs';

import type { AuthInfo } from '@modelcontextprotocol/server';

import { MCP_GUARDS, MCP_RESOLVER, MCP_TOOL } from '../decorators';
import { getAuthInfo, type McpAuthInfo } from '../index';
import type { McpExecutionContext } from '../interfaces/context.interface';
import type { McpContext } from '../interfaces/handler-context.interface';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { RegistryService } from './registry.service';
import { sdkContext } from './registry.service.test-helpers';

describe('RegistryService', () => {
  describe('guard dependency injection', () => {
    /**
     * A stand-in for the injected collaborator a real guard would use. Before
     * 2.0 these tests injected `SessionManager`, which no longer exists; the
     * regression they protect is unrelated to it and still matters — see
     * below.
     */
    class TokenStore {
      isRevoked(_token: string): boolean {
        return false;
      }
    }

    const buildRegistry = (mockModuleRef: {
      get: jest.Mock;
      create: jest.Mock;
    }) =>
      new RegistryService(
        { getAllMethodsWithMetadata: jest.fn() } as unknown as DiscoveryService,
        {
          log: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        } as unknown as McpLoggerService,
        new Reflector(),
        mockModuleRef as unknown as ModuleRef,
      );

    /**
     * This test verifies that guards can receive dependencies via NestJS DI.
     * Issue #70: dependency injection into guards was not working because
     * guards were instantiated with `new Guard()` instead of using ModuleRef.
     */
    it('should use ModuleRef.get to resolve guards from DI container', async () => {
      // Simple guard that always returns true
      class TestGuard implements CanActivate {
        canActivate(_context: any): boolean {
          return true;
        }
      }

      // Pre-instantiated guard (simulating what DI would return)
      const resolvedGuardInstance = new TestGuard();

      // Mock ModuleRef to return our pre-instantiated guard
      const mockModuleRef = {
        get: jest.fn().mockReturnValue(resolvedGuardInstance),
        create: jest.fn(),
      };

      const registryService = buildRegistry(mockModuleRef);

      // Create resolver with guard attached
      class TestResolver {
        testMethod(): string {
          return 'success';
        }
      }

      const resolverInstance = new TestResolver();

      // Set up metadata
      Reflect.defineMetadata(MCP_RESOLVER, { name: 'test' }, TestResolver);
      Reflect.defineMetadata(MCP_GUARDS, [TestGuard], TestResolver);

      // Mock getHandlerArgs to avoid Reflector dependency
      jest
        .spyOn(registryService as any, 'getHandlerArgs')
        .mockReturnValue({ type: 'tool' });

      // Run guards
      await registryService['runGuards'](
        resolverInstance,
        'testMethod',
        sdkContext() as McpContext,
        [sdkContext()],
      );

      // Verify ModuleRef.get was called with the guard class
      expect(mockModuleRef.get).toHaveBeenCalledWith(TestGuard, {
        strict: false,
      });
    });

    it('should inject collaborators into guards when registered as providers', async () => {
      // Guard that verifies its dependency was injected
      class TokenGuard implements CanActivate {
        public dependencyInjected = false;

        constructor(private tokens: TokenStore) {
          this.dependencyInjected = tokens !== undefined;
        }

        canActivate(_context: any): boolean {
          if (!this.tokens) {
            throw new Error('TokenStore was not injected!');
          }
          // Just verify injection worked, always allow
          return true;
        }
      }

      // Pre-instantiated guard WITH its dependency injected
      const injectedGuard = new TokenGuard(new TokenStore());
      expect(injectedGuard.dependencyInjected).toBe(true);

      // ModuleRef returns the pre-injected guard
      const mockModuleRef = {
        get: jest.fn().mockReturnValue(injectedGuard),
        create: jest.fn(),
      };

      const registryService = buildRegistry(mockModuleRef);

      class TestResolver {
        testMethod(): string {
          return 'success';
        }
      }

      const resolverInstance = new TestResolver();
      Reflect.defineMetadata(MCP_RESOLVER, { name: 'test' }, TestResolver);
      Reflect.defineMetadata(MCP_GUARDS, [TokenGuard], TestResolver);

      jest
        .spyOn(registryService as any, 'getHandlerArgs')
        .mockReturnValue({ type: 'tool' });

      // Should NOT throw - the guard should have its dependency injected
      await expect(
        registryService['runGuards'](
          resolverInstance,
          'testMethod',
          sdkContext() as McpContext,
          [sdkContext()],
        ),
      ).resolves.toBeUndefined();

      expect(mockModuleRef.get).toHaveBeenCalled();
    });

    it('denies, and logs, when a guard cannot be resolved from the container', async () => {
      // Fail closed, matching capability gates. Before 2.1 an unresolvable
      // guard fell back to `new Guard()`, which bypasses DI: every injected
      // field is `undefined`, and such a guard either throws or answers
      // something accidentally truthy — a fail-open.
      const constructed = jest.fn();
      class SimpleGuard implements CanActivate {
        constructor() {
          constructed();
        }
        canActivate(_context: any): boolean {
          return true;
        }
      }

      const mockModuleRef = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Not found in DI');
        }),
        create: jest.fn().mockImplementation(() => {
          throw new Error('Cannot create');
        }),
      };
      const logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn() };
      const registryService = new RegistryService(
        { getAllMethodsWithMetadata: jest.fn() } as unknown as DiscoveryService,
        logger as unknown as McpLoggerService,
        new Reflector(),
        mockModuleRef as unknown as ModuleRef,
      );

      class TestResolver {
        testMethod(this: void): string {
          return 'success';
        }
      }

      const resolverInstance = new TestResolver();
      const testMethodRef = TestResolver.prototype.testMethod;

      Reflect.defineMetadata(MCP_RESOLVER, { name: 'test' }, TestResolver);
      Reflect.defineMetadata(MCP_GUARDS, [SimpleGuard], TestResolver);
      Reflect.defineMetadata(MCP_TOOL, { name: 'test_tool' }, testMethodRef);

      jest
        .spyOn(registryService as any, 'getHandlerArgs')
        .mockReturnValue({ type: 'tool' });

      await expect(
        registryService['runGuards'](
          resolverInstance,
          'testMethod',
          sdkContext() as McpContext,
          [sdkContext()],
        ),
      ).rejects.toThrow(/Access denied/);
      expect(constructed).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SimpleGuard'),
        undefined,
        'guards',
      );
    });
  });

  describe('Observable guard results', () => {
    // `McpGuard.canActivate` may return an Observable, as Nest guards do. An
    // Observable object is truthy, so awaiting it without subscribing let
    // `of(false)` through.
    const runWith = (result: unknown) => {
      class ObservableGuard implements CanActivate {
        canActivate(_context: any) {
          return result as boolean;
        }
      }
      class TestResolver {
        testMethod(): string {
          return 'success';
        }
      }
      Reflect.defineMetadata(MCP_RESOLVER, { name: 'test' }, TestResolver);
      Reflect.defineMetadata(MCP_GUARDS, [ObservableGuard], TestResolver);
      const registryService = new RegistryService(
        { getAllMethodsWithMetadata: jest.fn() } as unknown as DiscoveryService,
        {
          log: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        } as unknown as McpLoggerService,
        new Reflector(),
        {
          get: jest.fn().mockReturnValue(new ObservableGuard()),
          create: jest.fn(),
        } as unknown as ModuleRef,
      );
      jest
        .spyOn(registryService as any, 'getHandlerArgs')
        .mockReturnValue({ type: 'tool' });
      return registryService['runGuards'](
        new TestResolver(),
        'testMethod',
        sdkContext() as McpContext,
        [sdkContext()],
      );
    };

    it('denies when a guard emits false', async () => {
      await expect(runWith(of(false))).rejects.toThrow(/Access denied/);
    });

    it('allows when a guard emits true', async () => {
      await expect(runWith(of(true))).resolves.toBeUndefined();
    });
  });

  describe('McpExecutionContext.getAuthInfo', () => {
    it('returns the effective AuthInfo to guards', async () => {
      let seen: McpExecutionContext | undefined;
      class CaptureGuard implements CanActivate {
        canActivate(context: any): boolean {
          seen = context as McpExecutionContext;
          return true;
        }
      }

      const registryService = new RegistryService(
        { getAllMethodsWithMetadata: jest.fn() } as unknown as DiscoveryService,
        { log: jest.fn(), error: jest.fn() } as unknown as McpLoggerService,
        new Reflector(),
        {
          get: jest.fn().mockReturnValue(new CaptureGuard()),
          create: jest.fn(),
        } as unknown as ModuleRef,
      );

      class AuthResolver {
        whoami(this: void): string {
          return 'me';
        }
      }
      Reflect.defineMetadata(MCP_GUARDS, [CaptureGuard], AuthResolver);
      Reflect.defineMetadata(
        MCP_TOOL,
        { name: 'whoami' },
        AuthResolver.prototype.whoami,
      );

      const fromSdk = { token: 'sdk', clientId: 'sdk', scopes: [] };
      const fromRequest = { token: 'req', clientId: 'req', scopes: [] };
      const ctx = {
        http: { authInfo: fromSdk },
        request: { headers: {}, auth: fromRequest },
      } as unknown as McpContext;

      await registryService['runGuards'](new AuthResolver(), 'whoami', ctx, [
        ctx,
      ]);
      expect(seen?.getAuthInfo?.()).toBe(fromSdk);

      const noHttp = {
        request: { headers: {}, auth: fromRequest },
      } as unknown as McpContext;
      await registryService['runGuards'](new AuthResolver(), 'whoami', noHttp, [
        noHttp,
      ]);
      expect(seen?.getAuthInfo?.()).toBe(fromRequest);
    });
  });

  /**
   * `getAuthInfo` and `McpAuthInfo<TExtra>`: one typed accessor for handlers
   * and guards. The type-level half is checked by `pnpm typecheck`.
   */
  describe('getAuthInfo', () => {
    // A type alias, not an interface: an alias is assignable to
    // `Record<string, unknown>` without gaining an index signature, so an
    // undeclared key stays a compile error.
    type TenantExtra = { tenant: string };

    const grant: McpAuthInfo<TenantExtra> = {
      token: 't',
      clientId: 'c',
      scopes: ['notes:read'],
      extra: { tenant: 'acme' },
    };

    it('reads the identity in a handler: http.authInfo, else request.auth', () => {
      const fromSdk = {
        http: { authInfo: grant },
        request: { headers: {} },
      } as unknown as McpContext;
      const fromRequest = {
        request: { headers: {}, auth: grant },
      } as unknown as McpContext;
      const anonymous = { request: { headers: {} } } as unknown as McpContext;

      const typed = getAuthInfo<TenantExtra>(fromSdk);
      const tenant: string | undefined = typed?.extra?.tenant;

      expect(tenant).toBe('acme');
      expect(getAuthInfo(fromRequest)).toBe(grant);
      expect(getAuthInfo(anonymous)).toBeUndefined();
    });

    it('reads the same identity in a guard', async () => {
      let tenant: string | undefined;
      class TenantGuard implements CanActivate {
        canActivate(context: any): boolean {
          tenant = getAuthInfo<TenantExtra>(context as McpExecutionContext)
            ?.extra?.tenant;
          return true;
        }
      }
      const registryService = new RegistryService(
        { getAllMethodsWithMetadata: jest.fn() } as unknown as DiscoveryService,
        { log: jest.fn(), error: jest.fn() } as unknown as McpLoggerService,
        new Reflector(),
        {
          get: jest.fn().mockReturnValue(new TenantGuard()),
          create: jest.fn(),
        } as unknown as ModuleRef,
      );
      class TenantResolver {
        whoami(this: void): string {
          return 'me';
        }
      }
      Reflect.defineMetadata(MCP_GUARDS, [TenantGuard], TenantResolver);
      Reflect.defineMetadata(
        MCP_TOOL,
        { name: 'whoami' },
        TenantResolver.prototype.whoami,
      );
      const ctx = {
        http: { authInfo: grant },
        request: { headers: {} },
      } as unknown as McpContext;

      await registryService['runGuards'](new TenantResolver(), 'whoami', ctx, [
        ctx,
      ]);

      expect(tenant).toBe('acme');
    });

    it('falls back to getContext() for a context without getAuthInfo', () => {
      const context = {
        getType: () => 'mcp',
        getContext: () =>
          ({ request: { headers: {}, auth: grant } }) as unknown as McpContext,
      } as unknown as McpExecutionContext;

      expect(getAuthInfo(context)).toBe(grant);
    });

    it('keeps McpExecutionContext and AuthInfo compatible at the type level', () => {
      // An implementer written against 2.0.0 (`getAuthInfo(): AuthInfo`)
      // still satisfies the interface, whose type parameter defaults.
      const legacy: Pick<McpExecutionContext, 'getAuthInfo'> = {
        getAuthInfo: (): AuthInfo | undefined => undefined,
      };
      // A typed context narrows `extra` for the guard that asks for it.
      const typedContext: Pick<
        McpExecutionContext<TenantExtra>,
        'getAuthInfo'
      > = { getAuthInfo: () => grant };
      const narrowed: string | undefined =
        typedContext.getAuthInfo?.()?.extra?.tenant;
      // The default `McpAuthInfo` is the SDK's `AuthInfo`, both ways.
      const widened: AuthInfo = grant;
      const plain: McpAuthInfo = widened;
      // @ts-expect-error — `extra` is typed: an undeclared key is refused.
      const unknownKey: unknown = typedContext.getAuthInfo?.()?.extra?.nope;

      expect([legacy, narrowed, plain, unknownKey]).toHaveLength(4);
    });
  });
});
