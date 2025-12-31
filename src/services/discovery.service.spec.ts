/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
import {
  DiscoveryModule,
  DiscoveryService as NestDiscoveryService,
  MetadataScanner,
  Reflector,
} from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Test, TestingModule } from '@nestjs/testing';

import { MCP_PROMPT, MCP_RESOURCE, MCP_TOOL } from '../decorators';
import { DiscoveryService } from './discovery.service';

describe('DiscoveryService', () => {
  let service: DiscoveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [DiscoveryService],
    }).compile();
    service = module.get(DiscoveryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty array for MCP_RESOURCE metadata', () => {
    const methods = service.getAllMethodsWithMetadata(MCP_RESOURCE);
    expect(methods).toBeDefined();
    expect(methods.length).toBe(0);
  });

  it('should return empty array for MCP_PROMPT metadata', () => {
    const methods = service.getAllMethodsWithMetadata(MCP_PROMPT);
    expect(methods).toBeDefined();
    expect(methods.length).toBe(0);
  });

  it('should return empty array for MCP_TOOL metadata', () => {
    const methods = service.getAllMethodsWithMetadata(MCP_TOOL);
    expect(methods).toBeDefined();
    expect(methods.length).toBe(0);
  });
});

describe('DiscoveryService edge cases', () => {
  let service: DiscoveryService;
  let mockNestDiscovery: jest.Mocked<NestDiscoveryService>;
  let mockMetadataScanner: jest.Mocked<MetadataScanner>;
  let mockReflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    mockNestDiscovery = {
      getProviders: jest.fn(),
      getControllers: jest.fn(),
    } as any;

    mockMetadataScanner = {
      getAllMethodNames: jest.fn(),
      scanFromPrototype: jest.fn(),
    } as any;

    mockReflector = {
      get: jest.fn(),
    } as any;

    service = new DiscoveryService(
      mockNestDiscovery,
      mockMetadataScanner,
      mockReflector,
    );
  });

  describe('getAllMethodsWithMetadata', () => {
    it('should skip providers without instance (lazy loading scenario)', () => {
      const providerWithoutInstance = {
        instance: null,
        metatype: class TestProvider {},
      } as unknown as InstanceWrapper;

      mockNestDiscovery.getProviders.mockReturnValue([providerWithoutInstance]);

      const result = service.getAllMethodsWithMetadata(MCP_TOOL);

      expect(result).toEqual([]);
      // Should not attempt to scan methods from null instance
      expect(mockMetadataScanner.getAllMethodNames).not.toHaveBeenCalled();
    });

    it('should skip providers with undefined instance', () => {
      const providerWithUndefinedInstance = {
        instance: undefined,
        metatype: class TestProvider {},
      } as unknown as InstanceWrapper;

      mockNestDiscovery.getProviders.mockReturnValue([
        providerWithUndefinedInstance,
      ]);

      const result = service.getAllMethodsWithMetadata(MCP_TOOL);

      expect(result).toEqual([]);
    });

    it('should handle multiple providers with mixed instances', () => {
      // Use a class instance so it has a proper prototype
      class ValidProvider {
        testMethod(): string {
          return 'result';
        }
      }

      const validInstance = new ValidProvider();
      const providerWithInstance = {
        instance: validInstance,
        metatype: ValidProvider,
      } as unknown as InstanceWrapper;

      const providerWithoutInstance = {
        instance: null,
        metatype: class NullProvider {},
      } as unknown as InstanceWrapper;

      mockNestDiscovery.getProviders.mockReturnValue([
        providerWithoutInstance,
        providerWithInstance,
      ]);

      mockMetadataScanner.getAllMethodNames.mockReturnValue(['testMethod']);
      mockReflector.get.mockReturnValue({ name: 'test_tool' });

      const result = service.getAllMethodsWithMetadata(MCP_TOOL);

      // Should only process the valid provider
      expect(result).toHaveLength(1);
      expect(result[0].method).toBe('testMethod');
    });
  });

  describe('getMethodsWithMetadataFromProvider', () => {
    it('should return empty array when provider has no instance', () => {
      const provider = {
        instance: null,
      } as unknown as InstanceWrapper;

      const result = service.getMethodsWithMetadataFromProvider(
        provider,
        MCP_TOOL,
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when prototype is null', () => {
      // Create an object with null prototype
      const instanceWithNullPrototype = Object.create(null);
      instanceWithNullPrototype.someMethod = () => {};

      const provider = {
        instance: instanceWithNullPrototype,
      } as unknown as InstanceWrapper;

      const result = service.getMethodsWithMetadataFromProvider(
        provider,
        MCP_TOOL,
      );

      expect(result).toEqual([]);
    });

    it('should skip properties that are not functions', () => {
      class TestClass {
        someMethod(): string {
          return 'result';
        }
      }

      const instance = new TestClass();
      const provider = { instance } as unknown as InstanceWrapper;

      // Return both a method name and a non-method property name
      mockMetadataScanner.getAllMethodNames.mockReturnValue([
        'someMethod',
        'notAFunction',
      ]);

      // Mock the prototype to have a non-function property
      const proto = Object.getPrototypeOf(instance);
      Object.defineProperty(proto, 'notAFunction', {
        value: 'string-value',
        configurable: true,
      });

      mockReflector.get.mockReturnValue({ name: 'test_tool' });

      const result = service.getMethodsWithMetadataFromProvider(
        provider,
        MCP_TOOL,
      );

      // Should only include the actual function
      expect(result).toHaveLength(1);
      expect(result[0].method).toBe('someMethod');

      // Cleanup
      delete proto.notAFunction;
    });

    it('should skip when instance property is not a function', () => {
      class TestClass {
        prototypeMethod(): string {
          return 'result';
        }
      }

      const instance = new TestClass() as any;
      // Override instance property with non-function
      instance.prototypeMethod = 'not-a-function';

      const provider = { instance } as unknown as InstanceWrapper;

      mockMetadataScanner.getAllMethodNames.mockReturnValue([
        'prototypeMethod',
      ]);
      mockReflector.get.mockReturnValue({ name: 'test_tool' });

      const result = service.getMethodsWithMetadataFromProvider(
        provider,
        MCP_TOOL,
      );

      // Should skip because instance property is not a function
      expect(result).toEqual([]);
    });

    it('should skip methods without matching metadata', () => {
      class TestClass {
        decoratedMethod(): string {
          return 'result';
        }
        unDecoratedMethod(): string {
          return 'other';
        }
      }

      const instance = new TestClass();
      const provider = { instance } as unknown as InstanceWrapper;

      mockMetadataScanner.getAllMethodNames.mockReturnValue([
        'decoratedMethod',
        'unDecoratedMethod',
      ]);

      // Only return metadata for decoratedMethod
      mockReflector.get.mockImplementation((key, target) => {
        if (target.name === 'decoratedMethod') {
          return { name: 'decorated_tool' };
        }
        return undefined;
      });

      const result = service.getMethodsWithMetadataFromProvider(
        provider,
        MCP_TOOL,
      );

      expect(result).toHaveLength(1);
      expect(result[0].method).toBe('decoratedMethod');
    });

    it('should preserve handler name property', () => {
      class TestClass {
        myToolMethod(): string {
          return 'result';
        }
      }

      const instance = new TestClass();
      const provider = { instance } as unknown as InstanceWrapper;

      mockMetadataScanner.getAllMethodNames.mockReturnValue(['myToolMethod']);
      mockReflector.get.mockReturnValue({ name: 'my_tool' });

      const result = service.getMethodsWithMetadataFromProvider(
        provider,
        MCP_TOOL,
      );

      expect(result).toHaveLength(1);
      expect(result[0].handler.name).toBe('myToolMethod');
    });

    it('should bind handler to correct instance context', () => {
      class TestClass {
        private value = 'instance-value';

        myMethod(): string {
          return this.value;
        }
      }

      const instance = new TestClass();
      const provider = { instance } as unknown as InstanceWrapper;

      mockMetadataScanner.getAllMethodNames.mockReturnValue(['myMethod']);
      mockReflector.get.mockReturnValue({ name: 'test' });

      const result = service.getMethodsWithMetadataFromProvider(
        provider,
        MCP_TOOL,
      );

      // Handler should be bound to instance, so 'this' works correctly
      expect(result[0].handler()).toBe('instance-value');
    });
  });
});
