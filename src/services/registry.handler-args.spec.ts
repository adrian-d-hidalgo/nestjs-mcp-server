/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { CanActivate } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';

import { MCP_PROMPT, MCP_RESOURCE, MCP_TOOL } from '../decorators';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { RegistryService } from './registry.service';

describe('RegistryService', () => {
  describe('getDecoratorType and getHandlerArgs', () => {
    let mockDiscovery: { getAllMethodsWithMetadata: jest.Mock };
    let mockLogger: { log: jest.Mock; error: jest.Mock; debug: jest.Mock };
    let mockReflector: Reflector;
    let mockModuleRef: { get: jest.Mock; create: jest.Mock };
    let registryService: RegistryService;

    beforeEach(() => {
      mockDiscovery = { getAllMethodsWithMetadata: jest.fn() };
      mockLogger = { log: jest.fn(), error: jest.fn(), debug: jest.fn() };
      mockReflector = new Reflector();
      mockModuleRef = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Not found');
        }),
        create: jest.fn().mockImplementation(() => {
          throw new Error('Cannot create');
        }),
      };

      registryService = new RegistryService(
        mockDiscovery as unknown as DiscoveryService,
        mockLogger as unknown as McpLoggerService,
        mockReflector,
        mockModuleRef as unknown as ModuleRef,
      );
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe('getDecoratorType', () => {
      it('should return null for undefined method', () => {
        const result = registryService['getDecoratorType'](undefined);
        expect(result).toBeNull();
      });

      it('should return TOOL for method with MCP_TOOL metadata', () => {
        const mockMethod = function testTool() {};
        Reflect.defineMetadata(MCP_TOOL, { name: 'test_tool' }, mockMethod);

        const result = registryService['getDecoratorType'](mockMethod as any);
        expect(result).toBe('TOOL');
      });

      it('should return null for method without MCP metadata', () => {
        const mockMethod = function noMetadata() {};

        const result = registryService['getDecoratorType'](mockMethod as any);
        expect(result).toBeNull();
      });
    });

    describe('getHandlerArgs', () => {
      it('should throw error when method is undefined', () => {
        expect(() => {
          registryService['getHandlerArgs'](undefined, []);
        }).toThrow('Method not found');
      });

      it('should throw error for unknown decorator type', () => {
        const mockMethod = function unknownMethod() {};

        expect(() => {
          registryService['getHandlerArgs'](mockMethod as any, []);
        }).toThrow('Unknown decorator type');
      });

      it('should return ToolHandlerArgs for TOOL with params', () => {
        const mockMethod = function testTool() {};
        Reflect.defineMetadata(MCP_TOOL, { name: 'test_tool' }, mockMethod);

        const params = { id: '123' };
        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          params,
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return ToolHandlerArgs for TOOL without params', () => {
        const mockMethod = function testTool() {};
        Reflect.defineMetadata(MCP_TOOL, { name: 'test_tool' }, mockMethod);

        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return PromptHandlerArgs for PROMPT with args', () => {
        const mockMethod = function testPrompt() {};
        Reflect.defineMetadata(MCP_PROMPT, { name: 'test_prompt' }, mockMethod);

        const promptArgs = { topic: 'test' };
        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          promptArgs,
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return PromptHandlerArgs for PROMPT without args', () => {
        const mockMethod = function testPrompt() {};
        Reflect.defineMetadata(MCP_PROMPT, { name: 'test_prompt' }, mockMethod);

        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return ResourceUriHandlerArgs for RESOURCE with URL', () => {
        const mockMethod = function testResource() {};
        Reflect.defineMetadata(
          MCP_RESOURCE,
          { name: 'test_resource' },
          mockMethod,
        );

        const url = new URL('https://example.com/resource');
        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          url,
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });

      it('should return ResourceTemplateHandlerArgs for RESOURCE with template params', () => {
        const mockMethod = function testResource() {};
        Reflect.defineMetadata(
          MCP_RESOURCE,
          { name: 'test_resource' },
          mockMethod,
        );

        const uri = 'template-uri';
        const templateParams = { id: '123' };
        const extra = { sessionId: 'session-1' };

        const result = registryService['getHandlerArgs'](mockMethod as any, [
          uri,
          templateParams,
          extra,
        ]);

        expect(result).toBeDefined();
        expect(result.extra).toEqual(extra);
      });
    });

    describe('resolveGuard', () => {
      it('should return guard instance if already instantiated', async () => {
        const guardInstance = { canActivate: jest.fn().mockReturnValue(true) };

        const result = await registryService['resolveGuard'](guardInstance);

        expect(result).toBe(guardInstance);
      });

      it('should use ModuleRef.create when ModuleRef.get fails', async () => {
        class TestGuard implements CanActivate {
          canActivate(): boolean {
            return true;
          }
        }

        const createdGuard = new TestGuard();
        mockModuleRef.create.mockResolvedValue(createdGuard);

        const result = await registryService['resolveGuard'](TestGuard);

        expect(mockModuleRef.get).toHaveBeenCalledWith(TestGuard, {
          strict: false,
        });
        expect(mockModuleRef.create).toHaveBeenCalledWith(TestGuard);
        expect(result).toBe(createdGuard);
      });
    });
  });
});
