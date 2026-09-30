import type {
  RegisteredPrompt,
  RegisteredResource,
  RegisteredResourceTemplate,
  RegisteredTool,
  ServerContext,
} from '@modelcontextprotocol/server';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import type { CanActivate, Type } from '@nestjs/common';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { isObservable, lastValueFrom } from 'rxjs';

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
import type {
  AuthenticatedRequest,
  McpContext,
} from '../interfaces/handler-context.interface';
import type { McpRegistrationContext } from '../interfaces/registration-context.interface';
import { MCP_AUTH_OPTIONS } from '../mcp.constants';
import type { McpAuthOptions } from '../mcp.types';
import type { McpHandlerArgs } from '../types/handler-args.types';
import {
  applyCapabilityToggle,
  CapabilityDisableError,
  type PendingCapabilityGate,
  settlePendingGates,
} from './capability-gates';
import {
  applyScopeVisibility,
  resolveCapabilityAccess,
  scopeChallenge,
} from './capability-scopes';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';

@Injectable()
export class RegistryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly logger: McpLoggerService,
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    @Optional()
    @Inject(MCP_AUTH_OPTIONS)
    private readonly authOptions?: McpAuthOptions,
  ) {}

  /**
   * Registers every discovered MCP capability on a freshly built server.
   *
   * Called once per HTTP request: the SDK's `createMcpHandler` builds a new
   * `McpServer` from the factory for every request, which is what makes the
   * server stateless and horizontally scalable.
   *
   * Resolves only once every capability gate has settled, so the caller may
   * hand the server to its transport knowing the capability set is final.
   *
   * Registration itself is synchronous: all SDK calls, and every `disable()`
   * for a static `enabled: false`, happen before the first `await`. Only
   * capabilities gated by a {@link McpCapabilityGate} class are deferred, and
   * they are settled in a **single** concurrency wave — the added latency is
   * the slowest gate, not the sum of them. A server that declares no gate
   * performs zero container lookups and zero awaited work.
   *
   * @param server The `McpServer` built for this request.
   * @param context The request context. Every gate is evaluated against it,
   * and every handler closure captures it, so a capability invoked later in
   * this same request sees the request it actually arrived on. Capabilities
   * whose toggle resolves to `false` are registered and then disabled, so the
   * SDK answers `<name> disabled` rather than `<name> not found`.
   */
  async registerAll(
    server: McpServer,
    context: McpRegistrationContext,
  ): Promise<void> {
    this.logger.log(
      'Starting registration of all MCP capabilities...',
      'registry',
    );

    const pending: PendingCapabilityGate[] = [];

    await this.registerResources(server, context, pending);
    await this.registerPrompts(server, context, pending);
    await this.registerTools(server, context, pending);

    await settlePendingGates(this.moduleRef, this.logger, pending, context);
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
  ): McpHandlerArgs {
    if (!method) throw new Error('Method not found');

    switch (this.getDecoratorType(method)) {
      case 'RESOURCE':
        return args[0] instanceof URL
          ? {
              type: 'resource:uri',
              uri: args[0],
              extra: args[1] as McpContext,
            }
          : {
              type: 'resource:template',
              uri: args[0] as URL,
              variables: args[1] as Record<string, string>,
              extra: args[2] as McpContext,
            };
      case 'PROMPT':
        return args.length === 1
          ? {
              type: 'prompt',
              extra: args[0] as McpContext,
            }
          : {
              type: 'prompt',
              args: args[0] as undefined,
              extra: args[1] as McpContext,
            };
      case 'TOOL':
        return args.length === 1
          ? {
              type: 'tool',
              extra: args[0] as McpContext,
            }
          : {
              type: 'tool',
              params: args[0] as undefined,
              extra: args[1] as McpContext,
            };
      default:
        throw new Error(`Unknown decorator type for method ${method.name}`);
    }
  }

  /**
   * Resolves a guard class through the Nest container.
   *
   * Fails **closed**, like the capability-gate resolver: there is no `new Guard()`
   * fallback. A guard built with `new` bypasses DI, leaving every injected
   * field `undefined`, and such a guard either throws or answers something
   * accidentally truthy. `null` means "could not resolve", which
   * {@link runGuards} turns into a denial plus a log line naming the guard.
   */
  private async resolveGuard(
    Guard: CanActivate | { new (...args: any[]): CanActivate },
  ): Promise<CanActivate | null> {
    if (typeof Guard !== 'function') {
      return Guard;
    }

    try {
      return this.moduleRef.get<CanActivate>(Guard, { strict: false });
    } catch {
      try {
        return await this.moduleRef.create<CanActivate>(Guard);
      } catch {
        return null;
      }
    }
  }

  /**
   * Executes all guards attached to the resolver class and method.
   * Throws an error if any guard denies access.
   *
   * @param instance The resolver instance
   * @param methodName The method name being invoked
   * @param mcpContext This invocation's context, carrying the live request
   * @param args The arguments passed to the method
   * @throws Error if any guard denies access
   */
  private runGuards(
    instance: object,
    methodName: string,
    mcpContext: McpContext,
    args: unknown[],
  ): Promise<void> {
    // Retrieve class-level guards
    const classConstructor = instance.constructor;

    const classGuards: (CanActivate | { new (): CanActivate })[] =
      (Reflect.getMetadata(MCP_GUARDS, classConstructor) as (
        CanActivate | { new (): CanActivate }
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
          CanActivate | { new (): CanActivate }
        )[])) ||
      [];

    // Combine guards: class-level first, then method-level
    const allGuards = [...classGuards, ...methodGuards];

    if (!allGuards.length) return Promise.resolve();

    const handlerArgs = this.getHandlerArgs(methodKey, args);

    const context: McpExecutionContext = {
      getType: () => 'mcp',
      getClass: () => instance.constructor as Type<any>,
      getHandler: () => methodKey as unknown as (...args: any[]) => any,
      getContext: () => mcpContext,
      getArgs: <T = any>() => handlerArgs as T,
      getRequest: <R = AuthenticatedRequest>() => mcpContext.request as R,
      getAuthInfo: () => mcpContext.http?.authInfo ?? mcpContext.request.auth,
    };

    return (async () => {
      for (const Guard of allGuards) {
        const guardInstance = await this.resolveGuard(Guard);

        if (!guardInstance) {
          this.logger.error(
            `Denying "${methodName}": its guard ${typeof Guard === 'function' ? Guard.name : 'instance'} could not be resolved from the container. Register it as a provider.`,
            undefined,
            'guards',
          );
          throw new Error(`Access denied by guard on ${methodName}`);
        }

        // Cast to any since MCP guards receive McpExecutionContext, not ExecutionContext
        const result = guardInstance.canActivate(context as any);
        // An Observable is truthy: it must be subscribed to, as Nest does.
        const allowed = isObservable(result)
          ? await lastValueFrom(result)
          : await result;

        if (!allowed)
          throw new Error(`Access denied by guard on ${methodName}`);
      }
    })();
  }

  /**
   * Wraps a resolver method as the callback the SDK will invoke.
   *
   * The SDK hands its own `ServerContext` as the final argument. This replaces
   * it with an {@link McpContext} — the same object plus the Express request
   * this invocation arrived on, captured from the registration context this
   * closure was built with.
   *
   * That capture is what replaced the 1.x session lookup. Before 2.0 this
   * method read `extra.sessionId`, rejected the call outright when it was
   * absent, and recovered the request from a process-local `SessionManager`
   * map — which is why the library could not run behind a load balancer, and
   * why the request it recovered was the connection's handshake rather than
   * the call's own.
   */
  private async wrappedHandler<TArgs extends unknown[], TResult>(
    instance: object,
    handler: (...args: TArgs) => TResult,
    args: unknown[],
    context: McpRegistrationContext,
  ) {
    const isResolver = Reflect.hasMetadata(MCP_RESOLVER, instance.constructor);

    if (!isResolver) {
      throw new Error(
        `Class "${instance.constructor.name}" must be decorated with @Resolver to use @Prompt, @Tool, or @Resource.`,
      );
    }

    const methodName = handler.name;

    const sdkContext = args[args.length - 1] as ServerContext;

    const mcpContext: McpContext = {
      ...sdkContext,
      request: context.request,
      headers: context.request.headers,
    };

    args[args.length - 1] = mcpContext;

    await this.runGuards(instance, methodName, mcpContext, args);

    return handler(...(args as TArgs));
  }

  /**
   * Returns `Promise<void>` but performs no awaited work, deliberately.
   *
   * Registration is synchronous by contract: every SDK call and every static
   * `disable()` completes before `registerAll` reaches its first `await`, which
   * keeps listing order deterministic and lets a gate-free server pay nothing.
   * The promise return is the seam the gate wave hangs off — `registerAll`
   * awaits these before settling `pending` — so it stays in the signature.
   */
  private registerResources(
    server: McpServer,
    context: McpRegistrationContext,
    pending: PendingCapabilityGate[],
  ): Promise<void> {
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
        this.wrappedHandler(instance, handler, args, context);

      try {
        // The capability's own access options over its resolver's defaults.
        const access = resolveCapabilityAccess(metadata, instance.constructor);

        // The handle is bound so the toggle can disable it, then released with
        // the loop iteration. Retaining handles is out of scope by design.
        //
        // Declared without `| undefined` on purpose: the chain below is
        // exhaustive, so dropping an assignment in any branch is a compile
        // error (TS2454, "used before being assigned") instead of a silent
        // no-op at `disable()` time.
        let handle: RegisteredResource | RegisteredResourceTemplate;

        const config = {
          ...('metadata' in metadata ? metadata.metadata : {}),
          ...(metadata.cacheHint !== undefined
            ? { cacheHint: metadata.cacheHint }
            : {}),
          ...(access.scopes !== undefined
            ? {
                scopeChallenge: scopeChallenge(this.authOptions, access.scopes),
              }
            : {}),
        };

        if ('template' in metadata) {
          handle = server.registerResource(
            metadata.name,
            new ResourceTemplate(metadata.template, { list: undefined }),
            config,
            wrappedHandler,
          );
        } else if ('uri' in metadata) {
          handle = server.registerResource(
            metadata.name,
            metadata.uri,
            config,
            wrappedHandler,
          );
        } else {
          // Unreachable through the typed API: every `ResourceOptions` member
          // declares `uri` or `template`. The `never` assignment is the
          // compile-time proof that the chain above is exhaustive, which is
          // what lets `handle` be declared without `| undefined`.
          const unhandled: never = metadata;
          throw new Error(
            `Resource metadata matched no registration branch: ${JSON.stringify(unhandled)}`,
          );
        }

        if (
          applyScopeVisibility(
            this.authOptions,
            this.logger,
            access,
            handle,
            'Resource',
            metadata.name,
            'resources',
            context,
          )
        ) {
          continue;
        }

        applyCapabilityToggle(
          this.logger,
          metadata.enabled,
          handle,
          'Resource',
          metadata.name,
          'resources',
          pending,
        );
      } catch (error) {
        // Fail closed: a capability that had to be withheld stayed enabled.
        if (error instanceof CapabilityDisableError) throw error;
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

    return Promise.resolve();
  }

  /** Synchronous by contract — see {@link registerResources}. */
  private registerPrompts(
    server: McpServer,
    context: McpRegistrationContext,
    pending: PendingCapabilityGate[],
  ): Promise<void> {
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
        this.wrappedHandler(instance, handler, args, context);

      try {
        // The capability's own access options over its resolver's defaults.
        const access = resolveCapabilityAccess(metadata, instance.constructor);

        // v2 exposes a single `registerPrompt(name, config, cb)`; the option
        // permutations that used to select between four positional overloads
        // are now just optional config fields.
        const handle: RegisteredPrompt = server.registerPrompt(
          metadata.name,
          {
            ...('description' in metadata
              ? { description: metadata.description }
              : {}),
            ...('argsSchema' in metadata
              ? { argsSchema: metadata.argsSchema }
              : {}),
            ...(metadata.title !== undefined ? { title: metadata.title } : {}),
            ...(metadata.icons !== undefined ? { icons: metadata.icons } : {}),
            ...(metadata._meta !== undefined ? { _meta: metadata._meta } : {}),
            ...(access.scopes !== undefined
              ? {
                  scopeChallenge: scopeChallenge(
                    this.authOptions,
                    access.scopes,
                  ),
                }
              : {}),
          },
          wrappedHandler,
        );

        if (
          applyScopeVisibility(
            this.authOptions,
            this.logger,
            access,
            handle,
            'Prompt',
            metadata.name,
            'prompts',
            context,
          )
        ) {
          continue;
        }

        applyCapabilityToggle(
          this.logger,
          metadata.enabled,
          handle,
          'Prompt',
          metadata.name,
          'prompts',
          pending,
        );
      } catch (error) {
        // Fail closed: a capability that had to be withheld stayed enabled.
        if (error instanceof CapabilityDisableError) throw error;
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

    return Promise.resolve();
  }

  /** Synchronous by contract — see {@link registerResources}. */
  private registerTools(
    server: McpServer,
    context: McpRegistrationContext,
    pending: PendingCapabilityGate[],
  ): Promise<void> {
    const toolMethods =
      this.discoveryService.getAllMethodsWithMetadata<ToolOptions>(MCP_TOOL);

    for (const method of toolMethods) {
      const { metadata, handler, instance } = method;

      this.logger.log(`Tool "${metadata?.name || 'unnamed'}" found.`, 'tools');

      const wrappedHandler = (...args: unknown[]) =>
        this.wrappedHandler(instance, handler, args, context);

      try {
        // The capability's own access options over its resolver's defaults.
        const access = resolveCapabilityAccess(metadata, instance.constructor);

        // v2 exposes a single `registerTool(name, config, cb)`. The eight
        // option permutations that used to select between positional overloads
        // are now just optional config fields.
        const handle: RegisteredTool = server.registerTool(
          metadata.name,
          {
            ...('description' in metadata
              ? { description: metadata.description }
              : {}),
            ...('paramsSchema' in metadata
              ? { inputSchema: metadata.paramsSchema }
              : {}),
            ...('annotations' in metadata
              ? { annotations: metadata.annotations }
              : {}),
            ...(metadata.title !== undefined ? { title: metadata.title } : {}),
            ...(metadata.outputSchema !== undefined
              ? { outputSchema: metadata.outputSchema }
              : {}),
            ...(metadata.icons !== undefined ? { icons: metadata.icons } : {}),
            ...(metadata._meta !== undefined ? { _meta: metadata._meta } : {}),
            ...(access.scopes !== undefined
              ? {
                  scopeChallenge: scopeChallenge(
                    this.authOptions,
                    access.scopes,
                  ),
                }
              : {}),
          },
          wrappedHandler,
        );

        if (
          applyScopeVisibility(
            this.authOptions,
            this.logger,
            access,
            handle,
            'Tool',
            metadata.name,
            'tools',
            context,
          )
        ) {
          continue;
        }

        applyCapabilityToggle(
          this.logger,
          metadata.enabled,
          handle,
          'Tool',
          metadata.name,
          'tools',
          pending,
        );
      } catch (error) {
        // Fail closed: a capability that had to be withheld stayed enabled.
        if (error instanceof CapabilityDisableError) throw error;
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

    return Promise.resolve();
  }
}
