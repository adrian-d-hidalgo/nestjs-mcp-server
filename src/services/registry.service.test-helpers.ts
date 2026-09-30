import type { ModuleRef, Reflector } from '@nestjs/core';

import type { McpRegistrationContext } from '../interfaces/registration-context.interface';
import type { DiscoveryService } from './discovery.service';
import type { McpLoggerService } from './logger.service';
import { RegistryService } from './registry.service';

/**
 * Shared fixtures for the `RegistryService` specs (`registry.*.spec.ts`).
 * Test-only: imported by specs, never by library code.
 */

/** A discovered resolver method, as `DiscoveryService` returns it. */
export interface MockMethod {
  metadata: Record<string, unknown>;
  instance: Record<string, unknown>;
  handler: jest.Mock;
}

/**
 * A registration context for one request.
 *
 * Since 2.0 `registerAll` runs per HTTP request and this context is required —
 * it carries the request that every handler closure and every guard will see.
 */
export function requestContext(
  headers: Record<string, string> = {},
): McpRegistrationContext {
  return {
    request: { headers, body: {} },
    era: 'modern',
  } as unknown as McpRegistrationContext;
}

/** The SDK `ServerContext` shape the transport passes as the last argument. */
export function sdkContext(method = 'tools/call'): unknown {
  return { mcpReq: { id: 1, method } };
}

/**
 * A `RegistryService` built from plain mocks, for the "unit tests for private
 * logic" suites. The container resolves nothing: `get` and `create` both throw.
 */
export function createPrivateLogicHarness() {
  const mockDiscovery = {
    getAllMethodsWithMetadata: jest.fn(),
  };
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const mockReflector = {
    get: jest.fn(),
    has: jest.fn(),
    hasMetadata: jest.fn(),
  };
  const mockServer = {
    registerResource: jest.fn(),
    registerPrompt: jest.fn(),
    registerTool: jest.fn(),
  };
  const mockModuleRef = {
    get: jest.fn().mockImplementation(() => {
      throw new Error('Not found in DI');
    }),
    create: jest.fn().mockImplementation(() => {
      throw new Error('Cannot create');
    }),
  };
  const service = new RegistryService(
    mockDiscovery as unknown as DiscoveryService,
    mockLogger as unknown as McpLoggerService,
    mockReflector as unknown as Reflector,
    mockModuleRef as unknown as ModuleRef,
  );

  return { service, mockDiscovery, mockLogger, mockReflector, mockServer };
}

export type PrivateLogicHarness = ReturnType<typeof createPrivateLogicHarness>;

/** A `DiscoveryService` double over real decorated classes. */
export const discoveryOver = (
  ...classes: (new () => object)[]
): DiscoveryService =>
  ({
    getAllMethodsWithMetadata: (key: string) =>
      classes.flatMap((Class) => {
        const instance = new Class();
        const proto = Class.prototype as Record<string, object>;
        return Object.getOwnPropertyNames(proto)
          .filter((name) => name !== 'constructor')
          .map((name) => ({
            method: name,
            metadata: Reflect.getMetadata(key, proto[name]) as unknown,
            handler: jest.fn(),
            instance,
          }))
          .filter((method) => method.metadata !== undefined);
      }),
  }) as unknown as DiscoveryService;
