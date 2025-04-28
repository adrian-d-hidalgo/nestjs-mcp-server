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

import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './mcp-logger.service';

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

  private registerResources(server: McpServer): void {
    this.logger.log('Starting resources registration...', 'resources');

    const resourceMethods =
      this.discoveryService.getAllMethodsWithMetadata<ResourceOptions>(
        MCP_RESOURCE,
      );

    this.logger.log(
      `Found ${resourceMethods.length} methods with @Resource decorator`,
      'resources',
    );

    for (const method of resourceMethods) {
      const { metadata, handler } = method;

      this.logger.verbose(
        `Processing resource: ${metadata?.name || 'unnamed'}`,
        'resources',
      );

      try {
        // Handle all possible resource registration formats:
        // 1. (name, template, metadata, cb) - template with metadata
        // 2. (name, template, cb) - template without metadata
        // 3. (name, uri, metadata, cb) - URI with metadata
        // 4. (name, uri, cb) - URI without metadata

        if ('template' in metadata) {
          this.logger.log(
            `Registering resource "${metadata.name}" with template: ${metadata.template}`,
            'resources',
          );

          if ('metadata' in metadata) {
            // Case 1: Template with metadata
            server.resource(
              metadata.name,
              new ResourceTemplate(metadata.template, { list: undefined }),
              metadata.metadata,
              handler,
            );
          }

          this.logger.log('Resource without metadata', 'resources');

          // Case 2: Template without metadata
          console.log(metadata.template);
          server.resource(
            metadata.name,
            new ResourceTemplate(metadata.template, { list: undefined }),
            handler,
          );
        } else if ('uri' in metadata) {
          this.logger.log(
            `Registering resource "${metadata.name}" with URI: ${metadata.uri}`,
            'resources',
          );

          if ('metadata' in metadata) {
            // Case 3: URI with metadata
            server.resource(
              metadata.name,
              metadata.uri,
              metadata.metadata,
              handler,
            );
          } else {
            // Case 4: URI without metadata
            server.resource(metadata.name, metadata.uri, handler);
          }
        }

        this.logger.log(
          `Resource "${metadata.name}" successfully registered`,
          'resources',
        );
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
    this.logger.log('Starting prompts registration...', 'prompts');

    const promptMethods =
      this.discoveryService.getAllMethodsWithMetadata<PromptOptions>(
        MCP_PROMPT,
      );

    this.logger.log(
      `Found ${promptMethods.length} methods with @Prompt decorator`,
      'prompts',
    );

    for (const method of promptMethods) {
      const { metadata, handler } = method;

      this.logger.verbose(
        `Processing prompt: ${metadata?.name || 'unnamed'}`,
        'prompts',
      );

      try {
        this.logger.log(`Registering prompt "${metadata.name}"`, 'prompts');

        if ('description' in metadata && 'argsSchema' in metadata) {
          // Case 1: (name, uri, metadata, cb)
          server.prompt(
            metadata.name,
            metadata.description,
            metadata.argsSchema,
            handler,
          );
        } else if ('argsSchema' in metadata) {
          // Case 2: (name, argsSchema, cb)
          server.prompt(metadata.name, metadata.argsSchema, handler);
        } else if ('description' in metadata) {
          // Case 3: (name, description, cb)
          server.prompt(metadata.name, metadata.description, handler);
        } else {
          // Case 4: (name, cb)
          server.prompt(metadata.name, handler);
        }

        this.logger.log(
          `Prompt "${metadata.name}" successfully registered`,
          'prompts',
        );
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
    this.logger.log('Starting tools registration...', 'tools');

    const toolMethods =
      this.discoveryService.getAllMethodsWithMetadata<ToolOptions>(MCP_TOOL);

    this.logger.log(
      `Found ${toolMethods.length} methods with @Tool decorator`,
      'tools',
    );

    for (const method of toolMethods) {
      const { metadata, handler } = method;

      this.logger.verbose(
        `Processing tool: ${metadata?.name || 'unnamed'}`,
        'tools',
      );

      if (metadata && metadata.name && handler) {
        try {
          this.logger.log(`Registering tool "${metadata.name}"`, 'tools');

          // Handle all possible tool registration formats:
          // 1. (name, description, paramSchema, cb)
          // 2. (name, paramSchema, cb)
          // 3. (name, description, cb)
          // 4. (name, cb)

          if ('description' in metadata && 'paramSchema' in metadata) {
            // Case 1: (name, description, paramSchema, cb)
            server.tool(
              metadata.name,
              metadata.description,
              metadata.paramSchema,
              handler,
            );
          } else if ('paramSchema' in metadata) {
            // Case 2: (name, paramSchema, cb)
            server.tool(metadata.name, metadata.paramSchema, handler);
          } else if ('description' in metadata) {
            // Case 3: (name, description, cb)
            server.tool(metadata.name, metadata.description, handler);
          } else {
            // Case 4: (name, cb)
            server.tool(metadata.name, handler);
          }
          this.logger.log(
            `Tool "${metadata.name}" successfully registered`,
            'tools',
          );
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
      } else {
        this.logger.warn(
          `Skipping tool with incomplete metadata: ${JSON.stringify({ name: metadata?.name, hasHandler: !!handler })}`,
          'tools',
        );
      }
    }
  }
}
