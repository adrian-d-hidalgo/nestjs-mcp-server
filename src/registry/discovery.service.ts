import { Injectable } from '@nestjs/common';
import {
  MetadataScanner,
  DiscoveryService as NestDiscoveryService,
  Reflector,
} from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

export interface MethodWithMetadata<T = unknown> {
  method: string;
  metadata: T;
  handler: (...args: any[]) => any;
  instance: object;
}

type ProviderInstance = Record<string, unknown>;

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly discoveryService: NestDiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Get all methods with specific metadata from all providers (now scans all @Injectable, not just @McpProvider)
   */
  public getAllMethodsWithMetadata<T = unknown>(
    metadataKey: string,
  ): MethodWithMetadata<T>[] {
    const providers = this.discoveryService.getProviders();
    const result: MethodWithMetadata<T>[] = [];

    // Scan ALL providers, not just those with MCP_PROVIDER
    for (const provider of providers) {
      if (!provider.instance) {
        continue;
      }

      const methods = this.getMethodsWithMetadataFromProvider<T>(
        provider,
        metadataKey,
      );

      if (methods.length > 0) {
        result.push(...methods);
      }
    }

    return result;
  }

  /**
   * Get all methods with a specific metadata from a single provider.
   */
  public getMethodsWithMetadataFromProvider<T = unknown>(
    provider: InstanceWrapper,
    metadataKey: string,
  ): MethodWithMetadata<T>[] {
    if (!provider.instance) {
      return [];
    }

    const instance = provider.instance as ProviderInstance;
    const instancePrototype = Object.getPrototypeOf(instance) as Record<
      string,
      unknown
    >;

    if (!instancePrototype) {
      return [];
    }

    const methodNames =
      this.metadataScanner.getAllMethodNames(instancePrototype);
    const result: MethodWithMetadata<T>[] = [];

    for (const methodName of methodNames) {
      // Removed hasOwnProperty check to allow inherited methods
      const methodFunction = instancePrototype[methodName];
      if (typeof methodFunction !== 'function') {
        continue;
      }

      const metadata = this.reflector.get<T>(metadataKey, methodFunction);

      if (metadata) {
        const handlerProperty = instance[methodName];

        if (typeof handlerProperty !== 'function') {
          continue;
        }

        const handler = ((...args: unknown[]): unknown => {
          return handlerProperty.apply(instance, args);
        }) as (...args: any[]) => any;

        result.push({
          method: methodName,
          metadata: metadata as T,
          handler,
          instance,
        });
      }
    }

    return result;
  }
}
