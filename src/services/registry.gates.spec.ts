/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { ModuleRef, Reflector } from '@nestjs/core';

import { MCP_PROMPT, MCP_RESOURCE, MCP_TOOL } from '../decorators';
import type {
  McpCapabilityGate,
  McpRegistrationContext,
} from '../interfaces/registration-context.interface';
import { DiscoveryService } from './discovery.service';
import { McpLoggerService } from './logger.service';
import { RegistryService } from './registry.service';
import type { MockMethod } from './registry.service.test-helpers';

describe('RegistryService', () => {
  /**
   * Capability gates: the `enabled` option resolved as a class through the Nest
   * container, awaited once per connection.
   *
   * Every case goes through the public `registerAll`, because that is where the
   * gate wave lives — the three register methods deliberately return before any
   * gate has settled.
   */
  describe('capability gates', () => {
    interface Handle {
      enabled: boolean;
      enable: jest.Mock;
      disable: jest.Mock;
      update: jest.Mock;
      remove: jest.Mock;
    }

    const createHandle = (): Handle => ({
      enabled: true,
      enable: jest.fn(),
      disable: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    });

    const discovered = (metadata: Record<string, unknown>): MockMethod => ({
      metadata,
      instance: { constructor: { name: 'DynamicResolver' } },
      handler: jest.fn(),
    });

    const context = {
      request: { headers: { 'x-role': 'admin' } },
    } as unknown as McpRegistrationContext;

    interface Harness {
      service: RegistryService;
      server: McpServer;
      /** The SDK registration mocks, exposed so a test can set the handle. */
      tool: jest.Mock;
      prompt: jest.Mock;
      resource: jest.Mock;
      logger: { log: jest.Mock; error: jest.Mock; debug: jest.Mock };
      moduleRef: { get: jest.Mock; create: jest.Mock };
    }

    const buildHarness = (
      methods: {
        tools?: MockMethod[];
        prompts?: MockMethod[];
        resources?: MockMethod[];
      },
      provided: [unknown, unknown][] = [],
    ): Harness => {
      const container = new Map<unknown, unknown>(provided);

      const discovery = {
        getAllMethodsWithMetadata: jest.fn((key: string) => {
          if (key === MCP_TOOL) return methods.tools ?? [];
          if (key === MCP_PROMPT) return methods.prompts ?? [];
          if (key === MCP_RESOURCE) return methods.resources ?? [];
          return [];
        }),
      };

      const logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn() };

      const moduleRef = {
        get: jest.fn((token: unknown) => {
          if (container.has(token)) return container.get(token);
          throw new Error('Nest could not find the provider');
        }),
        create: jest.fn(() => {
          throw new Error('Nest could not create the instance');
        }),
      };

      const service = new RegistryService(
        discovery as unknown as DiscoveryService,
        logger as unknown as McpLoggerService,
        new Reflector(),
        moduleRef as unknown as ModuleRef,
      );

      jest
        .spyOn(service as any, 'wrappedHandler')
        .mockReturnValue(() => 'wrapped-result');

      const tool = jest.fn();
      const prompt = jest.fn();
      const resource = jest.fn();
      const server = {
        registerResource: resource,
        registerPrompt: prompt,
        registerTool: tool,
      };

      return {
        service,
        server: server as unknown as McpServer,
        tool,
        prompt,
        resource,
        logger,
        moduleRef,
      };
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('resolves a gate class through ModuleRef and keeps the capability when it answers true', async () => {
      class AllowGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          return Promise.resolve(true);
        }
      }

      const handle = createHandle();
      const gate = new AllowGate();
      const harness = buildHarness(
        { tools: [discovered({ name: 'gated_tool', enabled: AllowGate })] },
        [[AllowGate, gate]],
      );
      harness.tool.mockReturnValue(handle);

      await harness.service.registerAll(harness.server, context);

      expect(harness.moduleRef.get).toHaveBeenCalledWith(AllowGate, {
        strict: false,
      });
      expect(handle.disable).not.toHaveBeenCalled();
    });

    it('disables a capability whose gate resolves false after a real tick', async () => {
      class DeniedGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          // A deferred promise, not Promise.resolve: a pending promise is
          // truthy, so an implementation that skips the await passes with
          // Promise.resolve and fails here.
          return new Promise((resolve) => setTimeout(() => resolve(false), 5));
        }
      }

      const handle = createHandle();
      const harness = buildHarness(
        { tools: [discovered({ name: 'gated_tool', enabled: DeniedGate })] },
        [[DeniedGate, new DeniedGate()]],
      );
      harness.tool.mockReturnValue(handle);

      await harness.service.registerAll(harness.server, context);

      expect(handle.disable).toHaveBeenCalledTimes(1);
    });

    it('passes the connection context to the gate', async () => {
      const isEnabled = jest.fn().mockResolvedValue(true);
      class ContextGate implements McpCapabilityGate {
        isEnabled(ctx: McpRegistrationContext): Promise<boolean> {
          return isEnabled(ctx) as Promise<boolean>;
        }
      }

      const harness = buildHarness(
        { tools: [discovered({ name: 'gated_tool', enabled: ContextGate })] },
        [[ContextGate, new ContextGate()]],
      );
      harness.tool.mockReturnValue(createHandle());

      await harness.service.registerAll(harness.server, context);

      expect(isEnabled).toHaveBeenCalledTimes(1);
      expect(isEnabled).toHaveBeenCalledWith(context);
    });

    it('has applied every gate verdict by the time registerAll resolves', async () => {
      // The async-ordering backstop. A missed `await` inside registerAll is only
      // an eslint warning, so nothing but this catches it.
      let release!: (value: boolean) => void;
      const deferred = new Promise<boolean>((resolve) => {
        release = resolve;
      });

      class DeferredGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          return deferred;
        }
      }

      const handle = createHandle();
      const harness = buildHarness(
        { tools: [discovered({ name: 'gated_tool', enabled: DeferredGate })] },
        [[DeferredGate, new DeferredGate()]],
      );
      harness.tool.mockReturnValue(handle);

      const registration = harness.service.registerAll(harness.server, context);

      expect(handle.disable).not.toHaveBeenCalled();

      release(false);
      await registration;

      expect(handle.disable).toHaveBeenCalledTimes(1);
    });

    it('asks each distinct gate class exactly once per request', async () => {
      const isEnabled = jest.fn().mockResolvedValue(true);
      class SharedGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          return isEnabled() as Promise<boolean>;
        }
      }

      const harness = buildHarness(
        {
          tools: [
            discovered({ name: 'tool_a', enabled: SharedGate }),
            discovered({ name: 'tool_b', enabled: SharedGate }),
            discovered({ name: 'tool_c', enabled: SharedGate }),
          ],
        },
        [[SharedGate, new SharedGate()]],
      );
      harness.tool.mockReturnValue(createHandle());

      await harness.service.registerAll(harness.server, context);

      // Before 2.0 this was one container resolution but N `isEnabled` calls,
      // which was affordable when gates ran once per connection. They now run
      // once per HTTP request, so the verdict is memoised per gate class for
      // the life of the call: three tools sharing a gate ask it once between
      // them. Safe because the registration context is a single object for
      // the whole call — and deliberately never cached beyond it, since a
      // verdict reused across requests would defeat the point.
      expect(harness.moduleRef.get).toHaveBeenCalledTimes(1);
      expect(isEnabled).toHaveBeenCalledTimes(1);
    });

    it('evaluates gates in one concurrent wave, not N serial round-trips', async () => {
      // Every gate must be in flight before any of them settles. A serial
      // implementation never reaches the third arrival and fails by timeout.
      const total = 3;
      let arrived = 0;
      let open!: () => void;
      const allArrived = new Promise<void>((resolve) => {
        open = resolve;
      });

      class BarrierGate implements McpCapabilityGate {
        async isEnabled(): Promise<boolean> {
          arrived += 1;
          if (arrived === total) open();
          await allArrived;
          return true;
        }
      }

      // Three *distinct* classes, not three capabilities sharing one: the
      // per-request verdict memo would collapse a shared gate to a single
      // call, and this test is about the wave being concurrent across gates.
      class BarrierGateA extends BarrierGate {}
      class BarrierGateB extends BarrierGate {}
      class BarrierGateC extends BarrierGate {}

      const harness = buildHarness(
        {
          tools: [
            discovered({ name: 'tool_a', enabled: BarrierGateA }),
            discovered({ name: 'tool_b', enabled: BarrierGateB }),
            discovered({ name: 'tool_c', enabled: BarrierGateC }),
          ],
        },
        [
          [BarrierGateA, new BarrierGateA()],
          [BarrierGateB, new BarrierGateB()],
          [BarrierGateC, new BarrierGateC()],
        ],
      );
      harness.tool.mockReturnValue(createHandle());

      await harness.service.registerAll(harness.server, context);

      expect(arrived).toBe(total);
    });

    it('falls back to ModuleRef.create when the gate is not a provider', async () => {
      class CreatableGate implements McpCapabilityGate {
        isEnabled(): boolean {
          return true;
        }
      }

      const handle = createHandle();
      const harness = buildHarness({
        tools: [discovered({ name: 'gated_tool', enabled: CreatableGate })],
      });
      harness.moduleRef.create.mockResolvedValue(new CreatableGate());
      harness.tool.mockReturnValue(handle);

      await harness.service.registerAll(harness.server, context);

      expect(harness.moduleRef.create).toHaveBeenCalledWith(CreatableGate);
      expect(handle.disable).not.toHaveBeenCalled();
    });

    describe('fail-closed', () => {
      it('case 1: a gate that throws synchronously disables it, siblings untouched', async () => {
        class ThrowingGate implements McpCapabilityGate {
          isEnabled(): boolean {
            throw new Error('entitlements service unreachable');
          }
        }

        const gatedHandle = createHandle();
        const siblingHandle = createHandle();
        const harness = buildHarness(
          {
            tools: [
              discovered({ name: 'throwing_tool', enabled: ThrowingGate }),
              discovered({ name: 'sibling_tool' }),
            ],
          },
          [[ThrowingGate, new ThrowingGate()]],
        );
        harness.tool
          .mockReturnValueOnce(gatedHandle)
          .mockReturnValueOnce(siblingHandle);

        await harness.service.registerAll(harness.server, context);

        expect(gatedHandle.disable).toHaveBeenCalledTimes(1);
        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('throwing_tool'),
          undefined,
          'tools',
        );
        expect(siblingHandle.disable).not.toHaveBeenCalled();
      });

      it('case 2: a gate whose promise rejects disables it, siblings untouched', async () => {
        class RejectingGate implements McpCapabilityGate {
          isEnabled(): Promise<boolean> {
            return Promise.reject(new Error('lookup timed out'));
          }
        }

        const gatedHandle = createHandle();
        const siblingHandle = createHandle();
        const harness = buildHarness(
          {
            tools: [
              discovered({ name: 'rejecting_tool', enabled: RejectingGate }),
              discovered({ name: 'sibling_tool' }),
            ],
          },
          [[RejectingGate, new RejectingGate()]],
        );
        harness.tool
          .mockReturnValueOnce(gatedHandle)
          .mockReturnValueOnce(siblingHandle);

        // A try/catch around the call — instead of around the await — catches
        // case 1 and misses this entirely, and an unhandled rejection would
        // abort the whole Promise.all wave.
        await expect(
          harness.service.registerAll(harness.server, context),
        ).resolves.toBeUndefined();

        expect(gatedHandle.disable).toHaveBeenCalledTimes(1);
        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('rejecting_tool'),
          undefined,
          'tools',
        );
        expect(siblingHandle.disable).not.toHaveBeenCalled();
      });

      it('case 3: an unresolvable gate class disables it and is never instantiated with new', async () => {
        const constructed = jest.fn();

        class UnresolvableGate implements McpCapabilityGate {
          constructor() {
            constructed();
          }

          isEnabled(): boolean {
            return true;
          }
        }

        const handle = createHandle();
        const harness = buildHarness({
          tools: [
            discovered({ name: 'orphan_tool', enabled: UnresolvableGate }),
          ],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).toHaveBeenCalledTimes(1);
        // Neither gates nor guards fall back to `new`: a `new`-built instance
        // has undefined dependencies and can answer truthy.
        expect(constructed).not.toHaveBeenCalled();
        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('orphan_tool'),
          undefined,
          'tools',
        );
      });

      // The former "case 4" covered a gate declared when `registerAll` was
      // called without a registration context. That branch is gone in 2.0:
      // the context is a required parameter, because the stateless model
      // always has exactly one request in hand when the server is built. The
      // scenario is now a compile error rather than a runtime fail-closed.

      it('case 5: a failing disable() leaves the capability enabled and says so', async () => {
        const handle = createHandle();
        handle.disable.mockImplementation(() => {
          throw new Error('sdk exploded');
        });

        const harness = buildHarness({
          tools: [discovered({ name: 'off_tool', enabled: false })],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to disable tool "off_tool"'),
          undefined,
          'tools',
        );
        expect(harness.logger.error).not.toHaveBeenCalledWith(
          expect.stringContaining('Error registering tool'),
          undefined,
          'tools',
        );
      });

      it('treats a non-boolean answer as disabled', async () => {
        class SloppyGate implements McpCapabilityGate {
          isEnabled(): boolean {
            return 'yes' as unknown as boolean;
          }
        }

        const handle = createHandle();
        const harness = buildHarness(
          { tools: [discovered({ name: 'sloppy_tool', enabled: SloppyGate })] },
          [[SloppyGate, new SloppyGate()]],
        );
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).toHaveBeenCalledTimes(1);
      });
    });

    describe('static toggles and the gate-free path', () => {
      it('disables a static false without consulting the container', async () => {
        const handle = createHandle();
        const harness = buildHarness({
          tools: [discovered({ name: 'off_tool', enabled: false })],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        // Register-then-disable, never skip-registration: the SDK must answer
        // "Tool off_tool disabled", not "Tool off_tool not found".
        expect(harness.tool).toHaveBeenCalledWith(
          'off_tool',
          {},
          expect.any(Function),
        );
        expect(handle.disable).toHaveBeenCalledTimes(1);
        expect(harness.moduleRef.get).not.toHaveBeenCalled();
        expect(harness.moduleRef.create).not.toHaveBeenCalled();
      });

      it('leaves a static true alone', async () => {
        const handle = createHandle();
        const harness = buildHarness({
          tools: [discovered({ name: 'on_tool', enabled: true })],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).not.toHaveBeenCalled();
        expect(harness.moduleRef.get).not.toHaveBeenCalled();
      });

      it('performs zero container lookups when no capability declares a gate', async () => {
        const handle = createHandle();
        const harness = buildHarness({
          tools: [discovered({ name: 'plain_tool' })],
          prompts: [discovered({ name: 'plain_prompt', description: 'd' })],
          resources: [
            discovered({ name: 'plain_resource', uri: 'https://example.com' }),
          ],
        });
        harness.tool.mockReturnValue(handle);
        harness.prompt.mockReturnValue(handle);
        harness.resource.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).not.toHaveBeenCalled();
        expect(harness.moduleRef.get).not.toHaveBeenCalled();
        expect(harness.moduleRef.create).not.toHaveBeenCalled();
      });
    });

    describe('prompts and resources honour a gate', () => {
      class DenyGate implements McpCapabilityGate {
        isEnabled(): Promise<boolean> {
          return Promise.resolve(false);
        }
      }

      it('disables a prompt whose gate answers false', async () => {
        const handle = createHandle();
        const harness = buildHarness(
          {
            prompts: [
              discovered({
                name: 'off_prompt',
                description: 'd',
                enabled: DenyGate,
              }),
            ],
          },
          [[DenyGate, new DenyGate()]],
        );
        harness.prompt.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(harness.prompt).toHaveBeenCalled();
        expect(handle.disable).toHaveBeenCalledTimes(1);
      });

      it('disables a resource whose gate answers false', async () => {
        const handle = createHandle();
        const harness = buildHarness(
          {
            resources: [
              discovered({
                name: 'off_resource',
                uri: 'https://example.com',
                enabled: DenyGate,
              }),
            ],
          },
          [[DenyGate, new DenyGate()]],
        );
        harness.resource.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(harness.resource).toHaveBeenCalled();
        expect(handle.disable).toHaveBeenCalledTimes(1);
      });
    });

    /**
     * Every registration branch must bind the handle it returns. A branch that
     * drops the assignment leaves that permutation silently un-gateable while
     * still type-checking at the call site — the `let handle` declaration
     * without `| undefined` is the compiler's half of this guarantee, and these
     * cases are the runtime half.
     */
    describe('handle binding across every registration branch', () => {
      it.each([
        ['ToolBaseOptions', {}],
        ['ToolWithDescriptionOptions', { description: 'd' }],
        ['ToolWithParamsSchemaOptions', { paramsSchema: { a: 'schema' } }],
        [
          'ToolWithParamsSchemaAndDescriptionOptions',
          { description: 'd', paramsSchema: { a: 'schema' } },
        ],
        ['ToolWithAnnotationsOptions', { annotations: { readOnlyHint: true } }],
        [
          'ToolWithAnnotationsAndDescriptionOptions',
          { description: 'd', annotations: { readOnlyHint: true } },
        ],
        [
          'ToolWithParamsSchemaAndAnnotationsOptions',
          {
            paramsSchema: { a: 'schema' },
            annotations: { readOnlyHint: true },
          },
        ],
        [
          'ToolWithParamsSchemaAndAnnotationsAndDescriptionOptions',
          {
            description: 'd',
            paramsSchema: { a: 'schema' },
            annotations: { readOnlyHint: true },
          },
        ],
      ])('binds the handle for %s', async (_name, extra) => {
        const handle = createHandle();
        const harness = buildHarness({
          tools: [
            discovered({ name: 'permutation_tool', enabled: false, ...extra }),
          ],
        });
        harness.tool.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(handle.disable).toHaveBeenCalledTimes(1);
      });

      it.each([
        [
          'a URI resource without metadata',
          { uri: 'https://example.com' },
          ['off_resource', 'https://example.com', {}],
        ],
        [
          'a URI resource with metadata',
          { uri: 'https://example.com', metadata: { version: '1.0' } },
          ['off_resource', 'https://example.com', { version: '1.0' }],
        ],
        [
          'a template resource without metadata',
          { template: 'resource://test/{id}' },
          ['off_resource', expect.any(ResourceTemplate), {}],
        ],
        [
          'a template resource with metadata',
          { template: 'resource://test/{id}', metadata: { version: '1.0' } },
          ['off_resource', expect.any(ResourceTemplate), { version: '1.0' }],
        ],
      ])('binds the handle for %s', async (_name, extra, expectedArgs) => {
        const handle = createHandle();
        const harness = buildHarness({
          resources: [
            discovered({ name: 'off_resource', enabled: false, ...extra }),
          ],
        });
        harness.resource.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        expect(harness.resource).toHaveBeenCalledWith(
          ...expectedArgs,
          expect.any(Function),
        );
        expect(handle.disable).toHaveBeenCalledTimes(1);
      });

      it('claims nothing was disabled when resource metadata matches no branch', async () => {
        const handle = createHandle();
        const harness = buildHarness({
          resources: [
            discovered({ name: 'malformed_resource', enabled: false }),
          ],
        });
        harness.resource.mockReturnValue(handle);

        await harness.service.registerAll(harness.server, context);

        // Nothing was registered, so nothing can be disabled — and the loop
        // must not claim otherwise.
        expect(harness.resource).not.toHaveBeenCalled();
        expect(handle.disable).not.toHaveBeenCalled();
        expect(harness.logger.log).not.toHaveBeenCalledWith(
          expect.stringContaining('disabled for this connection'),
          'resources',
        );
        expect(harness.logger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            'Error registering resource malformed_resource',
          ),
          undefined,
          'resources',
        );
      });
    });
  });
});
