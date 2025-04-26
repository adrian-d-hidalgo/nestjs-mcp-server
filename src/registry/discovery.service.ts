import { Injectable } from '@nestjs/common';
import {
  DiscoveryService as NestDiscoveryService,
  MetadataScanner,
  Reflector,
} from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { MCP_CAPABILITY_PROVIDER } from '../decorators/metadata.constants';

interface ProviderWithMetadata<T = unknown> {
  instance: object;
  metadata: T;
}

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
   * Get all providers with a specific metadata key.
   */
  getProvidersWithMetadata<T = unknown>(
    metadataKey: string,
  ): ProviderWithMetadata<T>[] {
    const providers = this.discoveryService.getProviders();
    const result: ProviderWithMetadata<T>[] = [];

    for (const provider of providers) {
      if (!provider.instance || !provider.metatype) {
        continue;
      }

      const metadata = this.reflector.get<T>(metadataKey, provider.metatype);
      if (metadata) {
        result.push({
          instance: provider.instance as object,
          metadata: metadata as T,
        });
      }
    }

    return result;
  }

  /**
   * Get all methods with specific metadata from all providers
   */
  getAllMethodsWithMetadata<T = unknown>(
    metadataKey: string,
  ): MethodWithMetadata<T>[] {
    const providers = this.discoveryService.getProviders();
    const result: MethodWithMetadata<T>[] = [];

    // Process capability providers
    const providersToProcess = new Set<InstanceWrapper>();

    // Find all capability providers
    const capabilityProviders = providers.filter(
      (provider) =>
        provider.instance &&
        provider.metatype &&
        this.reflector.get(MCP_CAPABILITY_PROVIDER, provider.metatype),
    );

    capabilityProviders.forEach((provider) => providersToProcess.add(provider));

    // Get methods from all capability providers
    for (const provider of providersToProcess) {
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
  getMethodsWithMetadataFromProvider<T = unknown>(
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
      if (
        !Object.prototype.hasOwnProperty.call(instancePrototype, methodName)
      ) {
        continue;
      }

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
          instance: instance as object,
        });
      }
    }

    return result;
  }
}
