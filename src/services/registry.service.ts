import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CanActivate, Type } from '@nestjs/common';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import {
  PromptHandlerArgs,
  ResourceTemplateHandlerArgs,
  ResourceUriHandlerArgs,
  ToolHandlerArgs,
} from '../classes';
import {
  MCP_GUARDS,
  MCP_PROMPT,
  MCP_RESOLVER,
  MCP_RESOURCE,
  MCP_TOOL,
  PromptOptions,
  ResourceOptions,
  ToolOptions,
} from '../decorators';
import { McpExecutionContext } from '../interfaces/context.interface';
import { RequestHandlerExtra } from '../mcp.types';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { SessionManager } from './session.manager';

@Injectable()
export class RegistryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly logger: McpLoggerService,
    private readonly reflector: Reflector,
    private readonly sessionManager: SessionManager,
  ) {}

  registerAll(server: McpServer): void {
    this.logger.log(
      'Starting registration of all MCP capabilities...',
      'registry',
    );

    this.registerResources(server);
    this.registerPrompts(server);
    this.registerTools(server);
  }

  private getDecoratorType(method: Type<any> | undefined): string | null {
    if (!method) return null;

    if (this.reflector.get(MCP_TOOL, method)) return 'TOOL';
    if (this.reflector.get(MCP_PROMPT, method)) return 'PROMPT';
    if (this.reflector.get(MCP_RESOURCE, method)) return 'RESOURCE';

    return null;
  }

  private getHandlerArgs(
    method: Type<any> | undefined,
    args: unknown[],
  ):
    | ResourceUriHandlerArgs
    | ResourceTemplateHandlerArgs
    | PromptHandlerArgs
    | ToolHandlerArgs {
    if (!method) throw new Error('Method not found');

    switch (this.getDecoratorType(method)) {
      case 'RESOURCE':
        return args[0] instanceof URL
          ? ResourceUriHandlerArgs.from(args[0], args[1] as RequestHandlerExtra)
          : ResourceTemplateHandlerArgs.from(
              args[0] as any,
              args[2] as RequestHandlerExtra,
              args[1] as Record<string, string>,
            );
      case 'PROMPT':
        return args.length === 1
          ? PromptHandlerArgs.from(args[0] as RequestHandlerExtra)
          : PromptHandlerArgs.from(
              args[1] as RequestHandlerExtra,
              args[0] as any,
            );
      case 'TOOL':
        return args.length === 1
          ? ToolHandlerArgs.from(args[0] as RequestHandlerExtra)
          : ToolHandlerArgs.from(
              args[1] as RequestHandlerExtra,
              args[0] as any,
            );
      default:
        throw new Error(`Unknown decorator type for method ${method.name}`);
    }
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
    sessionId: string,
    request: Request,
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

    const methodKey = prototype[methodName] as Type<any> | undefined;

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

    const handlerArgs = this.getHandlerArgs(methodKey, args);

    const context: McpExecutionContext = {
      args: handlerArgs,
      // @ts-expect-error: Default types are 'http' | 'ws' | 'rpc' but in our case, we are using 'mcp'
      getType: () => 'mcp',
      getClass: () => instance.constructor as Type<any>,
      getArgs: <T = any>() => args as T,
      getArgByIndex: <T = any>(index: number) => args[index] as T,
      getSessionId: () => sessionId,
      getHandler: () => methodKey as unknown as Type<any>,
      switchToHttp: () => ({
        getRequest: <R = Request>() => request as R,
        getResponse: () => {
          throw new Error('Response not available in MCP context');
        },
        getNext: () => {
          throw new Error('Next not available in MCP context');
        },
      }),
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

    const { sessionId } = args[args.length - 1] as RequestHandlerExtra;

    if (!sessionId) {
      throw new UnauthorizedException('Session ID is required');
    }

    const session = this.sessionManager.getSession(sessionId);

    if (!session) {
      throw new ForbiddenException('Session not found');
    }

    args[args.length - 1] = {
      ...(args[args.length - 1] as RequestHandlerExtra),
      headers: session.request.headers,
      body: session.request.body as Record<string, string>,
    };

    await this.runGuards(
      instance,
      methodName,
      sessionId,
      session.request,
      args,
    );

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
        if (
          'paramsSchema' in metadata &&
          'annotations' in metadata &&
          'description' in metadata
        ) {
          // ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions
          server.tool(
            metadata.name,
            metadata.description,
            metadata.paramsSchema,
            metadata.annotations,
            wrappedHandler,
          );
        } else if ('paramsSchema' in metadata && 'annotations' in metadata) {
          // ToolWithParamsSchemaAndAnnotationsOptions
          server.tool(
            metadata.name,
            metadata.paramsSchema,
            metadata.annotations,
            wrappedHandler,
          );
        } else if ('paramsSchema' in metadata && 'description' in metadata) {
          // ToolWithParamsSchemaAndDescriptionOptions
          server.tool(
            metadata.name,
            metadata.description,
            metadata.paramsSchema,
            wrappedHandler,
          );
        } else if ('annotations' in metadata && 'description' in metadata) {
          // ToolWithAnnotationsAndDescriptionOptions
          server.tool(
            metadata.name,
            metadata.description,
            metadata.annotations,
            wrappedHandler,
          );
        } else if ('paramsSchema' in metadata) {
          // ToolWithParamsSchemaOptions
          server.tool(metadata.name, metadata.paramsSchema, wrappedHandler);
        } else if ('annotations' in metadata) {
          // ToolWithAnnotationsOptions
          server.tool(metadata.name, metadata.annotations, wrappedHandler);
        } else if ('description' in metadata) {
          // ToolWithDescriptionOptions
          server.tool(metadata.name, metadata.description, wrappedHandler);
        } else {
          // ToolBaseOptions
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
