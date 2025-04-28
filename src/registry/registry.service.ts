import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable } from '@nestjs/common';

import {
  MCP_PROMPT,
  MCP_RESOURCE,
  MCP_TOOL,
} from '../decorators/capabilities.constants';
import {
  PromptOptions,
  ResourceOptions,
  ToolOptions,
} from '../interfaces/capabilities.interface';

import { MCP_RESOLVER } from '../decorators';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';

@Injectable()
export class RegistryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly logger: McpLoggerService,
  ) {}

  registerAll(server: McpServer): void {
    this.logger.log(
      'Starting registration of all MCP capabilities...',
      'registry',
    );
    this.registerResources(server);
    this.registerPrompts(server);
    this.registerTools(server);
    this.logger.log('MCP capabilities registration completed.', 'registry');
  }

  private wrappedHandler<TArgs extends unknown[], TResult>(
    handler: (...args: TArgs) => TResult,
    instance: object,
  ): (...args: TArgs) => TResult {
    const isResolver = Reflect.hasMetadata(MCP_RESOLVER, instance.constructor);

    if (!isResolver) {
      throw new Error(
        `Class "${instance.constructor.name}" must be decorated with @Resolver to use @Prompt, @Tool, or @Resource.`,
      );
    }

    return (...args: TArgs) => handler(...args);
  }

  private registerResources(server: McpServer): void {
    const resourceMethods =
      this.discoveryService.getAllMethodsWithMetadata<ResourceOptions>(
        MCP_RESOURCE,
      );
    for (const method of resourceMethods) {
      const { metadata, handler } = method;

      this.logger.log(
        `Resource "${metadata?.name || 'unnamed'}" found.`,
        'resources',
      );

      try {
        if ('template' in metadata) {
          if ('metadata' in metadata) {
            server.resource(
              metadata.name,
              new ResourceTemplate(metadata.template, { list: undefined }),
              metadata.metadata,
              handler,
            );
          } else {
            server.resource(
              metadata.name,
              new ResourceTemplate(metadata.template, { list: undefined }),
              handler,
            );
          }
        } else if ('uri' in metadata) {
          if ('metadata' in metadata) {
            server.resource(
              metadata.name,
              metadata.uri,
              metadata.metadata,
              handler,
            );
          } else {
            server.resource(metadata.name, metadata.uri, handler);
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

  private registerPrompts(server: McpServer): void {
    const promptMethods =
      this.discoveryService.getAllMethodsWithMetadata<PromptOptions>(
        MCP_PROMPT,
      );
    for (const method of promptMethods) {
      const { metadata, handler } = method;

      this.logger.log(
        `Prompt "${metadata?.name || 'unnamed'}" found.`,
        'prompts',
      );

      try {
        if ('description' in metadata && 'argsSchema' in metadata) {
          server.prompt(
            metadata.name,
            metadata.description,
            metadata.argsSchema,
            handler,
          );
        } else if ('argsSchema' in metadata) {
          server.prompt(metadata.name, metadata.argsSchema, handler);
        } else if ('description' in metadata) {
          server.prompt(metadata.name, metadata.description, handler);
        } else {
          server.prompt(metadata.name, handler);
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

  private registerTools(server: McpServer): void {
    const toolMethods =
      this.discoveryService.getAllMethodsWithMetadata<ToolOptions>(MCP_TOOL);

    for (const method of toolMethods) {
      const { metadata, handler, instance } = method;

      this.logger.log(`Tool "${metadata?.name || 'unnamed'}" found.`, 'tools');

      try {
        if ('description' in metadata && 'paramSchema' in metadata) {
          server.tool(
            metadata.name,
            metadata.description,
            metadata.paramSchema,
            this.wrappedHandler(handler, instance),
          );
        } else if ('paramSchema' in metadata) {
          server.tool(
            metadata.name,
            metadata.paramSchema,
            this.wrappedHandler(handler, instance),
          );
        } else if ('description' in metadata) {
          server.tool(
            metadata.name,
            metadata.description,
            this.wrappedHandler(handler, instance),
          );
        } else {
          server.tool(metadata.name, this.wrappedHandler(handler, instance));
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
