/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { McpServer } from '@modelcontextprotocol/server';
import { DiscoveryModule, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import type { McpContext } from '../interfaces/handler-context.interface';
import type { McpRegistrationContext } from '../interfaces/registration-context.interface';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { RegistryService } from './registry.service';
import {
  createPrivateLogicHarness,
  requestContext,
  sdkContext,
} from './registry.service.test-helpers';

describe('RegistryService', () => {
  let service: RegistryService;

  describe('with Nest TestingModule', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [DiscoveryModule],
        providers: [
          RegistryService,
          DiscoveryService,
          McpLoggerService,
          Reflector,
        ],
      }).compile();

      service = module.get(RegistryService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should call registerResources, registerPrompts, registerTools in registerAll', async () => {
      const server = {
        registerResource: jest.fn(),
        registerPrompt: jest.fn(),
        registerTool: jest.fn(),
      } as unknown as McpServer;

      const spyRes = jest
        .spyOn(service as any, 'registerResources')
        .mockResolvedValue(undefined);

      const spyPro = jest
        .spyOn(service as any, 'registerPrompts')
        .mockResolvedValue(undefined);

      const spyTool = jest
        .spyOn(service as any, 'registerTools')
        .mockResolvedValue(undefined);

      const context = requestContext();

      await service.registerAll(server, context);

      expect(spyRes).toHaveBeenCalledWith(server, context, expect.any(Array));
      expect(spyPro).toHaveBeenCalledWith(server, context, expect.any(Array));
      expect(spyTool).toHaveBeenCalledWith(server, context, expect.any(Array));
    });

    it('should forward the registration context to every register method', async () => {
      const server = {
        registerResource: jest.fn(),
        registerPrompt: jest.fn(),
        registerTool: jest.fn(),
      } as unknown as McpServer;

      const context = {
        request: { headers: { 'x-role': 'admin' } },
      } as unknown as McpRegistrationContext;

      const spyRes = jest
        .spyOn(service as any, 'registerResources')
        .mockResolvedValue(undefined);

      const spyPro = jest
        .spyOn(service as any, 'registerPrompts')
        .mockResolvedValue(undefined);

      const spyTool = jest
        .spyOn(service as any, 'registerTools')
        .mockResolvedValue(undefined);

      await service.registerAll(server, context);

      expect(spyRes).toHaveBeenCalledWith(server, context, expect.any(Array));
      expect(spyPro).toHaveBeenCalledWith(server, context, expect.any(Array));
      expect(spyTool).toHaveBeenCalledWith(server, context, expect.any(Array));
    });

    it('should require a registration context and return a promise', async () => {
      const server = {
        registerResource: jest.fn(),
        registerPrompt: jest.fn(),
        registerTool: jest.fn(),
      } as unknown as McpServer;

      jest
        .spyOn(service as any, 'registerResources')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'registerPrompts')
        .mockResolvedValue(undefined);
      jest.spyOn(service as any, 'registerTools').mockResolvedValue(undefined);

      // Two shape changes are pinned here, both MAJOR. `registerAll` returns a
      // promise that must be awaited — a consumer who ignores it holds an
      // incomplete registration — and the context is now required, because
      // under the stateless model there is always exactly one request being
      // served and every gate and guard is evaluated against it.
      const result: Promise<void> = service.registerAll(
        server,
        requestContext(),
      );

      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });
  });

  describe('unit tests for private logic', () => {
    beforeEach(() => {
      ({ service } = createPrivateLogicHarness());
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should throw if wrappedHandler is called on non-resolver', async () => {
      const handler = jest.fn();
      const instance = { constructor: () => {} };

      // Mock Reflect.hasMetadata (used inside RegistryService)
      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(false);

      await expect(
        service['wrappedHandler'](
          instance,
          handler,
          [sdkContext()],
          requestContext(),
        ),
      ).rejects.toThrow(/must be decorated with @Resolver/);
    });

    /**
     * Before 2.0 this method demanded `extra.sessionId`, threw
     * `UnauthorizedException` without one and `ForbiddenException` when the
     * in-process `SessionManager` had no entry for it. Under the 2026-07-28
     * stateless model there is no session id on any request, so those two
     * branches would have rejected *every* call — they are gone, and these
     * tests replace them.
     */
    it('should invoke the handler with no session id present', async () => {
      const handler = jest
        .fn<string, [Record<string, unknown>]>()
        .mockReturnValue('success');
      const instance = { constructor: { name: 'TestResolver' } };

      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);
      jest.spyOn(service as any, 'runGuards').mockResolvedValue(undefined);

      const result = await service['wrappedHandler'](
        instance,
        handler,
        [sdkContext()],
        requestContext({ 'x-test': 'value' }),
      );

      expect(result).toBe('success');
    });

    it('should hand the handler this request’s own headers', async () => {
      const handler = jest
        .fn<string, [Record<string, unknown>]>()
        .mockReturnValue('success');
      const instance = { constructor: { name: 'TestResolver' } };

      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);
      const runGuardsSpy = jest
        .spyOn(service as any, 'runGuards')
        .mockResolvedValue(undefined);

      await service['wrappedHandler'](
        instance,
        handler,
        [sdkContext()],
        requestContext({ 'x-test': 'value' }),
      );

      // The context carries the live request, not a connect-time snapshot.
      // In 1.x these headers came from the `initialize` POST stored in the
      // session map and were frozen for the connection's life.
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'x-test': 'value' },
          request: expect.objectContaining({
            headers: { 'x-test': 'value' },
          }),
        }),
      );
      expect(runGuardsSpy).toHaveBeenCalled();
    });

    it('should preserve the SDK context fields it was given', async () => {
      const handler = jest
        .fn<string, [Record<string, unknown>]>()
        .mockReturnValue('success');
      const instance = { constructor: { name: 'TestResolver' } };

      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);
      jest.spyOn(service as any, 'runGuards').mockResolvedValue(undefined);

      await service['wrappedHandler'](
        instance,
        handler,
        [sdkContext('prompts/get')],
        requestContext(),
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpReq: expect.objectContaining({ method: 'prompts/get' }),
        }),
      );
    });

    it('runGuards should resolve if no guards', async () => {
      const instance = { constructor: () => {} };
      const methodName = 'someMethod';
      const args: unknown[] = [];

      await expect(
        service['runGuards'](
          instance,
          methodName,
          sdkContext() as McpContext,
          args,
        ),
      ).resolves.toBeUndefined();
    });

    it('runGuards should throw if guard denies access', async () => {
      const instance = { constructor: () => {} };
      const methodName = 'someMethod';
      const args: unknown[] = [];
      const guard = { canActivate: jest.fn().mockResolvedValue(false) };

      // Mock Reflect.getMetadata to return the guard
      jest.spyOn(Reflect, 'getMetadata').mockReturnValue([guard]);

      // Mock the private methods that are called inside runGuards
      jest.spyOn(service as any, 'getDecoratorType').mockReturnValue('TOOL');
      jest
        .spyOn(service as any, 'getHandlerArgs')
        .mockReturnValue({ type: 'tool' });

      await expect(
        service['runGuards'](
          instance,
          methodName,
          sdkContext() as McpContext,
          args,
        ),
      ).rejects.toThrow(/Access denied by guard/);
    });
  });
});
