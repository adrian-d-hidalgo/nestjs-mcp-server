import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CanActivate, Type } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

import { MCP_RESOLVER } from '../decorators';
import {
  MCP_PROMPT,
  MCP_RESOURCE,
  MCP_TOOL,
} from '../decorators/capabilities.constants';
import { MCP_GUARDS } from '../decorators/capabilities.decorators';
import {
  PromptOptions,
  ResourceOptions,
  ToolOptions,
} from '../interfaces/capabilities.interface';
import { McpExecutionContext } from '../interfaces/context.interface';
import { MessageService } from '../services/message.service';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
@Injectable()
export class RegistryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly logger: McpLoggerService,
    private readonly messageService: MessageService,
  ) {}

  async registerAll(server: McpServer): Promise<void> {
    this.logger.log(
      'Starting registration of all MCP capabilities...',
      'registry',
    );

    await Promise.all([
      this.registerResources(server),
      this.registerPrompts(server),
      this.registerTools(server),
    ]);
  }

  /**
   * Executes all guards attached to the resolver class and method.
   * Throws an error if any guard denies access.
   *
   * @param instance The resolver instance
   * @param methodName The method name being invoked
   * @param args The arguments passed to the method
   * @throws Error if any guard denies access
   */
  private runGuards(
    instance: object,
    methodName: string,
    args: unknown[],
  ): Promise<void> {
    // Retrieve class-level guards
    const classConstructor = instance.constructor;
    const classGuards: (CanActivate | { new (): CanActivate })[] =
      (Reflect.getMetadata(MCP_GUARDS, classConstructor) as (
        | CanActivate
        | { new (): CanActivate }
      )[]) || [];

    // Retrieve method-level guards
    const prototype = Object.getPrototypeOf(instance) as Record<
      string,
      unknown
    >;
    const methodKey = prototype[methodName] as object | undefined;

    const methodGuards: (CanActivate | { new (): CanActivate })[] =
      (methodKey &&
        (Reflect.getMetadata(MCP_GUARDS, methodKey) as (
          | CanActivate
          | { new (): CanActivate }
        )[])) ||
      [];

    // Combine guards: class-level first, then method-level
    const allGuards = [...classGuards, ...methodGuards];

    if (!allGuards.length) return Promise.resolve();
    // Build a minimal context (customize as needed)
    const context: McpExecutionContext = {
      args,
      message: this.messageService.get(),

      // @ts-expect-error: Default types are 'http' | 'ws' | 'rpc' but in our case
      // we are using 'mcp'
      getType: () => 'mcp',
      getClass: () => instance.constructor as Type<any>,
      getArgs: <T extends Array<any>>() => args as T,
    };

    return (async () => {
      for (const Guard of allGuards) {
        const guardInstance: CanActivate =
          typeof Guard === 'function' ? new Guard() : Guard;
        const allowed = await guardInstance.canActivate(context);

        if (!allowed)
          throw new Error(`Access denied by guard on ${methodName}`);
      }
    })();
  }

  private async wrappedHandler<TArgs extends unknown[], TResult>(
    instance: object,
    handler: (...args: TArgs) => TResult,
    args: unknown[],
  ) {
    const isResolver = Reflect.hasMetadata(MCP_RESOLVER, instance.constructor);

    if (!isResolver) {
      throw new Error(
        `Class "${instance.constructor.name}" must be decorated with @Resolver to use @Prompt, @Tool, or @Resource.`,
      );
    }

    const methodName = handler.name;

    await this.runGuards(instance, methodName, args);

    return handler(...(args as TArgs));
  }

  private registerResources(server: McpServer) {
    const resourceMethods =
      this.discoveryService.getAllMethodsWithMetadata<ResourceOptions>(
        MCP_RESOURCE,
      );
    for (const method of resourceMethods) {
      const { metadata, handler, instance } = method;

      this.logger.log(
        `Resource "${metadata?.name || 'unnamed'}" found.`,
        'resources',
      );

      const wrappedHandler = (...args: unknown[]) =>
        this.wrappedHandler(instance, handler, args);

      try {
        if ('template' in metadata) {
          if ('metadata' in metadata) {
            server.resource(
              metadata.name,
              new ResourceTemplate(metadata.template, { list: undefined }),
              metadata.metadata,
              wrappedHandler,
            );
          } else {
            server.resource(
              metadata.name,
              new ResourceTemplate(metadata.template, { list: undefined }),
              wrappedHandler,
            );
          }
        } else if ('uri' in metadata) {
          if ('metadata' in metadata) {
            server.resource(
              metadata.name,
              metadata.uri,
              metadata.metadata,
              wrappedHandler,
            );
          } else {
            server.resource(metadata.name, metadata.uri, wrappedHandler);
          }
        }
      } catch (error) {
        this.logger.error(
          `Error registering resource ${metadata.name}: ${error}`,
          undefined,
          'resources',
        );
        if (error && typeof error === 'object' && 'stack' in error) {
          this.logger.error(
            `Error stack: ${(error as Error).stack}`,
            undefined,
            'resources',
          );
        }
      }
    }
  }

  private registerPrompts(server: McpServer) {
    const promptMethods =
      this.discoveryService.getAllMethodsWithMetadata<PromptOptions>(
        MCP_PROMPT,
      );
    for (const method of promptMethods) {
      const { metadata, handler, instance } = method;

      this.logger.log(
        `Prompt "${metadata?.name || 'unnamed'}" found.`,
        'prompts',
      );

      const wrappedHandler = (...args: unknown[]) =>
        this.wrappedHandler(instance, handler, args);

      try {
        if ('description' in metadata && 'argsSchema' in metadata) {
          server.prompt(
            metadata.name,
            metadata.description,
            metadata.argsSchema,
            wrappedHandler,
          );
        } else if ('argsSchema' in metadata) {
          server.prompt(metadata.name, metadata.argsSchema, wrappedHandler);
        } else if ('description' in metadata) {
          server.prompt(metadata.name, metadata.description, wrappedHandler);
        } else {
          server.prompt(metadata.name, wrappedHandler);
        }
      } catch (error) {
        this.logger.error(
          `Error registering prompt ${metadata.name}: ${error}`,
          undefined,
          'prompts',
        );
        if (error && typeof error === 'object' && 'stack' in error) {
          this.logger.error(
            `Error stack: ${(error as Error).stack}`,
            undefined,
            'prompts',
          );
        }
      }
    }
  }

  private registerTools(server: McpServer) {
    const toolMethods =
      this.discoveryService.getAllMethodsWithMetadata<ToolOptions>(MCP_TOOL);

    for (const method of toolMethods) {
      const { metadata, handler, instance } = method;

      this.logger.log(`Tool "${metadata?.name || 'unnamed'}" found.`, 'tools');

      const wrappedHandler = (...args: unknown[]) =>
        this.wrappedHandler(instance, handler, args);

      try {
        if ('description' in metadata && 'paramSchema' in metadata) {
          server.tool(
            metadata.name,
            metadata.description,
            metadata.paramSchema,
            wrappedHandler,
          );
        } else if ('paramSchema' in metadata) {
          server.tool(metadata.name, metadata.paramSchema, wrappedHandler);
        } else if ('description' in metadata) {
          server.tool(metadata.name, metadata.description, wrappedHandler);
        } else {
          server.tool(metadata.name, wrappedHandler);
        }
      } catch (error) {
        this.logger.error(
          `Error registering tool ${metadata.name}: ${error}`,
          undefined,
          'tools',
        );
        if (error && typeof error === 'object' && 'stack' in error) {
          this.logger.error(
            `Stack trace: ${(error as Error).stack}`,
            undefined,
            'tools',
          );
        }
      }
    }
  }
}
