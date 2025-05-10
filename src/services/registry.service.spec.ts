import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DiscoveryModule, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { RegistryService } from './registry.service';
import { SessionManager } from './session.manager';

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
          SessionManager,
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
        resource: jest.fn(),
        prompt: jest.fn(),
        tool: jest.fn(),
      } as unknown as McpServer;

      const spyRes = jest
        .spyOn(service as any, 'registerResources')
        .mockImplementation(() => {});

      const spyPro = jest
        .spyOn(service as any, 'registerPrompts')
        .mockImplementation(() => {});

      const spyTool = jest
        .spyOn(service as any, 'registerTools')
        .mockImplementation(() => {});

      await service.registerAll(server);

      expect(spyRes).toHaveBeenCalledWith(server);
      expect(spyPro).toHaveBeenCalledWith(server);
      expect(spyTool).toHaveBeenCalledWith(server);
    });
  });

  describe('unit tests for private logic', () => {
    let mockDiscovery: DiscoveryService;
    let mockLogger: McpLoggerService;
    let mockReflector: Reflector;
    let mockSession: SessionManager;

    beforeEach(() => {
      mockDiscovery = {
        getAllMethodsWithMetadata: jest.fn(),
      } as unknown as DiscoveryService;
      mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as unknown as McpLoggerService;
      mockReflector = {
        get: jest.fn(),
        has: jest.fn(),
        hasMetadata: jest.fn(),
      } as unknown as Reflector;
      mockSession = {
        getSession: jest.fn(),
        setSession: jest.fn(),
        deleteSession: jest.fn(),
      } as unknown as SessionManager;
      service = new RegistryService(
        mockDiscovery,
        mockLogger,
        mockReflector,
        mockSession,
      );
    });

    it('should throw if wrappedHandler is called on non-resolver', async () => {
      const handler = jest.fn();
      const instance = { constructor: () => {} };

      // Mock Reflect.hasMetadata (used inside RegistryService)
      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(false);

      await expect(
        service['wrappedHandler'](instance, handler, [{}]),
      ).rejects.toThrow(/must be decorated with @Resolver/);
    });

    it('should throw UnauthorizedException if sessionId is missing', async () => {
      const handler = jest.fn();
      const instance = { constructor: { name: 'TestResolver' } };

      // Mock Reflect.hasMetadata to return true for MCP_RESOLVER
      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

      await expect(
        service['wrappedHandler'](instance, handler, [{}]),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if session not found', async () => {
      const handler = jest.fn();
      const instance = { constructor: { name: 'TestResolver' } };

      // Mock Reflect.hasMetadata to return true for MCP_RESOLVER
      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

      (mockSession.getSession as jest.Mock).mockReturnValue(undefined);

      await expect(
        service['wrappedHandler'](instance, handler, [
          { sessionId: 'notfound' },
        ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully execute the handler when everything is valid', async () => {
      const handler = jest
        .fn<string, [Record<string, unknown>]>()
        .mockReturnValue('success');
      const instance = { constructor: { name: 'TestResolver' } };
      const sessionId = 'valid-session';
      const extra = { sessionId };

      // Mock Reflect.hasMetadata to return true for MCP_RESOLVER
      jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

      (mockSession.getSession as jest.Mock).mockReturnValue({
        request: { headers: { 'x-test': 'value' }, body: { key: 'value' } },
      });

      // Mock runGuards to resolve successfully
      jest.spyOn(service as any, 'runGuards').mockResolvedValue(undefined);

      const result = await service['wrappedHandler'](instance, handler, [
        extra,
      ] as unknown[]);

      expect(result).toBe('success');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          headers: { 'x-test': 'value' },
          body: { key: 'value' },
        }),
      );
      expect(service['runGuards']).toHaveBeenCalled();
    });

    it('runGuards should resolve if no guards', async () => {
      const instance = { constructor: () => {} };
      const methodName = 'someMethod';
      const sessionId = 'abc';
      const request: unknown = {};
      const args: unknown[] = [];

      await expect(
        service['runGuards'](
          instance,
          methodName,
          sessionId,
          request as any,
          args,
        ),
      ).resolves.toBeUndefined();
    });

    it('runGuards should throw if guard denies access', async () => {
      const instance = { constructor: () => {} };
      const methodName = 'someMethod';
      const sessionId = 'abc';
      const request: unknown = {};
      const args: unknown[] = [];
      const guard = { canActivate: jest.fn().mockResolvedValue(false) };

      // Mock Reflect.getMetadata to return the guard
      jest.spyOn(Reflect, 'getMetadata').mockReturnValue([guard]);

      // Mock the private methods that are called inside runGuards
      jest.spyOn(service as any, 'getDecoratorType').mockReturnValue('TOOL');
      jest.spyOn(service as any, 'getHandlerArgs').mockReturnValue({
        sessionId,
        headers: {},
        body: {},
      });

      await expect(
        service['runGuards'](
          instance,
          methodName,
          sessionId,
          request as any,
          args,
        ),
      ).rejects.toThrow(/Access denied by guard/);
    });
  });
});
