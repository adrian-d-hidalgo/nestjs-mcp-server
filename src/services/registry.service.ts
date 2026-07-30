import type {
  RegisteredPrompt,
  RegisteredResource,
  RegisteredResourceTemplate,
  RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js';
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
import { ModuleRef, Reflector } from '@nestjs/core';
import { Request } from 'express';

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
  McpCapabilityGate,
  McpCapabilityToggle,
  McpRegistrationContext,
} from '../interfaces/registration-context.interface';
import { RequestHandlerExtra } from '../mcp.types';
import type { McpHandlerArgs } from '../types/handler-args.types';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { SessionManager } from './session.manager';

/** The four SDK registration handles, all of which expose `disable()`. */
type McpCapabilityHandle =
  | RegisteredPrompt
  | RegisteredResource
  | RegisteredResourceTemplate
  | RegisteredTool;

/**
 * A capability that is registered and whose gate has not been consulted yet.
 *
 * Registration is synchronous by design: every SDK call, and every `disable()`
 * for a static `enabled: false`, completes before the first `await`. Anything
 * gated by a class lands here instead and is settled in one concurrency wave
 * once all three register methods have returned.
 *
 * The list is local to a `registerAll` call and released with it — no handle is
 * retained beyond the call.
 */
interface PendingCapabilityGate {
  handle: McpCapabilityHandle;
  /** Capability label used in the log line, e.g. `Tool`. */
  label: string;
  name: string;
  /** Logger context — `tools`, `prompts` or `resources`. */
  scope: string;
  Gate: Type<McpCapabilityGate>;
}

/** Memoises `resolveGate` for the life of one `registerAll` call. */
type GateResolutionCache = Map<
  Type<McpCapabilityGate>,
  Promise<McpCapabilityGate | null>
>;

@Injectable()
export class RegistryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly logger: McpLoggerService,
    private readonly reflector: Reflector,
    private readonly sessionManager: SessionManager,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Registers every discovered MCP capability on a freshly built server.
   *
   * Resolves only once every capability gate has settled, so the caller may
   * connect the server to its transport knowing the capability set is final.
   *
   * Registration itself is synchronous: all SDK calls, and every `disable()`
   * for a static `enabled: false`, happen before the first `await`. Only
   * capabilities gated by a {@link McpCapabilityGate} class are deferred, and
   * they are settled in a **single** concurrency wave — the added connection
   * latency is the slowest gate, not the sum of them. A server that declares
   * no gate performs zero container lookups and zero awaited work.
   *
   * @param server The `McpServer` built for one client connection.
   * @param context Optional connection context. Every gate is evaluated
   * against it once, at registration time. Capabilities whose toggle resolves
   * to `false` are registered and then disabled, so the SDK answers
   * `<name> disabled` rather than `<name> not found`. A capability declaring a
   * gate when no context was provided fails closed.
   */
  async registerAll(
    server: McpServer,
    context?: McpRegistrationContext,
  ): Promise<void> {
    this.logger.log(
      'Starting registration of all MCP capabilities...',
      'registry',
    );

    const pending: PendingCapabilityGate[] = [];

    await this.registerResources(server, context, pending);
    await this.registerPrompts(server, context, pending);
    await this.registerTools(server, context, pending);

    await this.settlePendingGates(pending, context);
  }

  /**
   * Settles every deferred gate in one concurrency wave.
   *
   * Each evaluation is written so it can never reject, so `Promise.all` never
   * short-circuits: one failing gate can neither abort the wave nor strip the
   * capabilities beside it, and nothing escapes into the transport's
   * `try/catch` to turn the connection into a 500.
   */
  private async settlePendingGates(
    pending: PendingCapabilityGate[],
    context: McpRegistrationContext | undefined,
  ): Promise<void> {
    if (!pending.length) return;

    // Call-local: one resolution per distinct gate class per connection,
    // released with the call.
    const cache: GateResolutionCache = new Map();

    await Promise.all(
      pending.map(async (capability) => {
        const enabled = await this.isCapabilityEnabled(
          capability,
          context,
          cache,
        );

        if (!enabled) {
          this.disableCapability(
            capability.handle,
            capability.label,
            capability.name,
            capability.scope,
          );
        }
      }),
    );
  }

  /**
   * Resolves a capability gate class through the Nest container.
   *
   * Mirrors {@link resolveGuard} with one deliberate divergence: there is no
   * `new Gate()` fallback. A gate built with `new` bypasses DI, leaving every
   * injected field `undefined`, and such a gate either throws or returns
   * something accidentally truthy — a fail-**open**, which this design forbids.
   * `moduleRef.create` already covers a dependency-free class, so the third
   * fallback would buy nothing and risk the one outcome that is unacceptable.
   *
   * Never rejects: `null` means "could not resolve", which the caller turns
   * into a disabled capability plus a log line naming it.
   */
  private async resolveGate(
    Gate: Type<McpCapabilityGate>,
  ): Promise<McpCapabilityGate | null> {
    try {
      return this.moduleRef.get<McpCapabilityGate>(Gate, { strict: false });
    } catch {
      try {
        return await this.moduleRef.create<McpCapabilityGate>(Gate);
      } catch {
        // Logged by the caller, which knows which capability is affected. One
        // resolution can be shared by many capabilities, so logging here would
        // name the gate but not the capability the consumer is looking for.
        return null;
      }
    }
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
              extra: args[1] as RequestHandlerExtra,
            }
          : {
              type: 'resource:template',
              uri: args[0] as URL,
              variables: args[1] as Record<string, string>,
              extra: args[2] as RequestHandlerExtra,
            };
      case 'PROMPT':
        return args.length === 1
          ? {
              type: 'prompt',
              extra: args[0] as RequestHandlerExtra,
            }
          : {
              type: 'prompt',
              args: args[0] as undefined,
              extra: args[1] as RequestHandlerExtra,
            };
      case 'TOOL':
        return args.length === 1
          ? {
              type: 'tool',
              extra: args[0] as RequestHandlerExtra,
            }
          : {
              type: 'tool',
              params: args[0] as undefined,
              extra: args[1] as RequestHandlerExtra,
            };
      default:
        throw new Error(`Unknown decorator type for method ${method.name}`);
    }
  }

  private async resolveGuard(
    Guard: CanActivate | { new (): CanActivate },
  ): Promise<CanActivate> {
    if (typeof Guard !== 'function') {
      return Guard;
    }

    try {
      return this.moduleRef.get<CanActivate>(Guard, { strict: false });
    } catch {
      try {
        return await this.moduleRef.create<CanActivate>(Guard);
      } catch {
        return new Guard();
      }
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
      getSessionId: () => sessionId,
      getArgs: <T = any>() => handlerArgs as T,
      getRequest: <R = Request>() => request as R,
    };

    return (async () => {
      for (const Guard of allGuards) {
        const guardInstance = await this.resolveGuard(Guard);
        // Cast to any since MCP guards receive McpExecutionContext, not ExecutionContext
        const allowed = await guardInstance.canActivate(context as any);

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

  /**
   * Applies a capability's `enabled` toggle at registration time.
   *
   * Synchronous on purpose — this is the hot path every capability walks:
   *
   * - absent / `true` — nothing happens, and nothing is deferred.
   * - `false` — disabled immediately, with no container round-trip.
   * - a gate class — deferred to the concurrency wave in `registerAll`.
   *
   * @param toggle The capability's `enabled` option, if it declared one.
   * @param handle The SDK registration handle just bound for this capability.
   * @param label Capability label used in the log line, e.g. `Tool`.
   * @param name The capability name.
   * @param scope Logger context — `tools`, `prompts` or `resources`.
   * @param pending The `registerAll` call's list of deferred gates.
   */
  private applyCapabilityToggle(
    toggle: McpCapabilityToggle | undefined,
    handle: McpCapabilityHandle,
    label: string,
    name: string,
    scope: string,
    pending: PendingCapabilityGate[],
  ): void {
    if (toggle === undefined || toggle === true) return;

    if (toggle === false) {
      this.disableCapability(handle, label, name, scope);
      return;
    }

    pending.push({ handle, label, name, scope, Gate: toggle });
  }

  /**
   * Asks a capability's gate whether it is available to this connection.
   *
   * Fails **closed** on every failure mode, because failing open would silently
   * expose a capability the consumer intended to gate:
   *
   * 1. `isEnabled` throws synchronously.
   * 2. `isEnabled` returns a **rejecting** promise — a distinct path, which is
   *    why the `try` wraps the `await` and not merely the call.
   * 3. the gate class cannot be resolved from the container.
   * 4. a gate is declared and no registration context exists.
   *
   * Never rejects, so the surrounding `Promise.all` can never short-circuit.
   *
   * @param capability The deferred capability and its gate class.
   * @param context The connection context, absent when `registerAll` was
   * called with a single argument.
   * @param cache Per-call memo, so N capabilities sharing one gate class cost
   * one container resolution.
   */
  private async isCapabilityEnabled(
    capability: PendingCapabilityGate,
    context: McpRegistrationContext | undefined,
    cache: GateResolutionCache,
  ): Promise<boolean> {
    const { Gate, name, scope } = capability;

    if (!context) {
      this.logger.error(
        `Disabling "${name}": its "enabled" gate requires a registration context and none was provided.`,
        undefined,
        scope,
      );
      return false;
    }

    let resolution = cache.get(Gate);

    if (!resolution) {
      resolution = this.resolveGate(Gate);
      cache.set(Gate, resolution);
    }

    const gate = await resolution;

    if (!gate) {
      this.logger.error(
        `Disabling "${name}": its "enabled" gate ${Gate.name} could not be resolved from the container. Register it as a provider.`,
        undefined,
        scope,
      );
      return false;
    }

    try {
      // The await is inside the try on purpose: a rejected promise and a
      // synchronous throw are different code paths, and wrapping only the call
      // would catch the second and miss the first.
      const verdict = await gate.isEnabled(context);

      // Strict comparison, not truthiness: anything that is not exactly `true`
      // — including a value a JavaScript caller slipped past the types — is
      // treated as a denial rather than accidentally exposing the capability.
      return verdict === true;
    } catch (error) {
      this.logger.error(
        `Disabling "${name}": its "enabled" gate ${Gate.name} failed: ${error}`,
        undefined,
        scope,
      );
      return false;
    }
  }

  /**
   * Disables a capability whose `enabled` toggle resolved to `false`.
   *
   * The `disable()` call is isolated from the surrounding registration
   * `try/catch` deliberately. If it threw there, the outer handler would log
   * "Error registering <name>" and the capability would stay **enabled** —
   * failing open, the exact inversion of the consumer's intent. Here the
   * failure gets its own log line that says the capability is still exposed.
   *
   * @param handle The SDK registration handle returned by `server.tool` /
   * `server.prompt` / `server.resource`.
   * @param label Capability label used in the log line, e.g. `Tool`.
   * @param name The capability name.
   * @param scope Logger context — `tools`, `prompts` or `resources`.
   */
  private disableCapability(
    handle: McpCapabilityHandle,
    label: string,
    name: string,
    scope: string,
  ): void {
    try {
      handle.disable();
      this.logger.log(
        `${label} "${name}" disabled for this connection.`,
        scope,
      );
    } catch (error) {
      this.logger.error(
        `Failed to disable ${label.toLowerCase()} "${name}": it remains enabled for this connection. ${error}`,
        undefined,
        scope,
      );
    }
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
    context: McpRegistrationContext | undefined,
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
        this.wrappedHandler(instance, handler, args);

      try {
        // The handle is bound so the toggle can disable it, then released with
        // the loop iteration. Retaining handles is out of scope by design.
        //
        // Declared without `| undefined` on purpose: the chain below is
        // exhaustive, so dropping an assignment in any branch is a compile
        // error (TS2454, "used before being assigned") instead of a silent
        // no-op at `disable()` time.
        let handle: RegisteredResource | RegisteredResourceTemplate;

        if ('template' in metadata) {
          if ('metadata' in metadata) {
            handle = server.resource(
              metadata.name,
              new ResourceTemplate(metadata.template, { list: undefined }),
              metadata.metadata,
              wrappedHandler,
            );
          } else {
            handle = server.resource(
              metadata.name,
              new ResourceTemplate(metadata.template, { list: undefined }),
              wrappedHandler,
            );
          }
        } else if ('uri' in metadata) {
          if ('metadata' in metadata) {
            handle = server.resource(
              metadata.name,
              metadata.uri,
              metadata.metadata,
              wrappedHandler,
            );
          } else {
            handle = server.resource(
              metadata.name,
              metadata.uri,
              wrappedHandler,
            );
          }
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

        this.applyCapabilityToggle(
          metadata.enabled,
          handle,
          'Resource',
          metadata.name,
          'resources',
          pending,
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

    return Promise.resolve();
  }

  /** Synchronous by contract — see {@link registerResources}. */
  private registerPrompts(
    server: McpServer,
    context: McpRegistrationContext | undefined,
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
        this.wrappedHandler(instance, handler, args);

      try {
        // The handle is bound so the toggle can disable it, then released with
        // the loop iteration. Retaining handles is out of scope by design.
        let handle: RegisteredPrompt;

        if ('description' in metadata && 'argsSchema' in metadata) {
          handle = server.prompt(
            metadata.name,
            metadata.description,
            metadata.argsSchema,
            wrappedHandler,
          );
        } else if ('argsSchema' in metadata) {
          handle = server.prompt(
            metadata.name,
            metadata.argsSchema,
            wrappedHandler,
          );
        } else if ('description' in metadata) {
          handle = server.prompt(
            metadata.name,
            metadata.description,
            wrappedHandler,
          );
        } else {
          handle = server.prompt(metadata.name, wrappedHandler);
        }

        this.applyCapabilityToggle(
          metadata.enabled,
          handle,
          'Prompt',
          metadata.name,
          'prompts',
          pending,
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

    return Promise.resolve();
  }

  /** Synchronous by contract — see {@link registerResources}. */
  private registerTools(
    server: McpServer,
    context: McpRegistrationContext | undefined,
    pending: PendingCapabilityGate[],
  ): Promise<void> {
    const toolMethods =
      this.discoveryService.getAllMethodsWithMetadata<ToolOptions>(MCP_TOOL);

    for (const method of toolMethods) {
      const { metadata, handler, instance } = method;

      this.logger.log(`Tool "${metadata?.name || 'unnamed'}" found.`, 'tools');

      const wrappedHandler = (...args: unknown[]) =>
        this.wrappedHandler(instance, handler, args);

      try {
        // The handle is bound so the toggle can disable it, then released with
        // the loop iteration. Retaining handles is out of scope by design.
        let handle: RegisteredTool;

        if (
          'paramsSchema' in metadata &&
          'annotations' in metadata &&
          'description' in metadata
        ) {
          // ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions
          handle = server.tool(
            metadata.name,
            metadata.description,
            metadata.paramsSchema,
            metadata.annotations,
            wrappedHandler,
          );
        } else if ('paramsSchema' in metadata && 'annotations' in metadata) {
          // ToolWithParamsSchemaAndAnnotationsOptions
          handle = server.tool(
            metadata.name,
            metadata.paramsSchema,
            metadata.annotations,
            wrappedHandler,
          );
        } else if ('paramsSchema' in metadata && 'description' in metadata) {
          // ToolWithParamsSchemaAndDescriptionOptions
          handle = server.tool(
            metadata.name,
            metadata.description,
            metadata.paramsSchema,
            wrappedHandler,
          );
        } else if ('annotations' in metadata && 'description' in metadata) {
          // ToolWithAnnotationsAndDescriptionOptions
          handle = server.tool(
            metadata.name,
            metadata.description,
            metadata.annotations,
            wrappedHandler,
          );
        } else if ('paramsSchema' in metadata) {
          // ToolWithParamsSchemaOptions
          handle = server.tool(
            metadata.name,
            metadata.paramsSchema,
            wrappedHandler,
          );
        } else if ('annotations' in metadata) {
          // ToolWithAnnotationsOptions
          handle = server.tool(
            metadata.name,
            metadata.annotations,
            wrappedHandler,
          );
        } else if ('description' in metadata) {
          // ToolWithDescriptionOptions
          handle = server.tool(
            metadata.name,
            metadata.description,
            wrappedHandler,
          );
        } else {
          // ToolBaseOptions
          handle = server.tool(metadata.name, wrappedHandler);
        }

        this.applyCapabilityToggle(
          metadata.enabled,
          handle,
          'Tool',
          metadata.name,
          'tools',
          pending,
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
    }

    return Promise.resolve();
  }
}
