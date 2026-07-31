/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
import { CallToolResult } from '@modelcontextprotocol/server';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';

import {
  MCP_PROMPT,
  MCP_RESOURCE,
  MCP_TOOL,
  McpCapabilityGate,
  McpCapabilityToggle,
  McpRegistrationContext,
  Prompt,
  Resolver,
  Resource,
  Tool,
} from '../index';

/**
 * Consumer call site for the `enabled` capability gate.
 *
 * Everything here is imported from the package root exactly as a published
 * consumer would import it. If a symbol used below is not exported from
 * `src/index.ts`, this file fails to compile.
 */

/** The injected dependency a bare lambda could never have reached. */
@Injectable()
class PermissionsService {
  isAdmin(clientId?: string): Promise<boolean> {
    return Promise.resolve(clientId === 'admin-client');
  }
}

/** The shape the redesign exists for: a class, injected, answering async. */
@Injectable()
class AdminGate implements McpCapabilityGate {
  constructor(private readonly permissions: PermissionsService) {}

  async isEnabled(context: McpRegistrationContext): Promise<boolean> {
    if (context.request.headers['x-role'] === 'admin') return true;

    return this.permissions.isAdmin(context.authInfo?.clientId);
  }
}

/** A gate may still answer synchronously — `boolean | Promise<boolean>`. */
@Injectable()
class DebugGate implements McpCapabilityGate {
  isEnabled(context: McpRegistrationContext): boolean {
    return context.request.headers['x-debug'] === 'on';
  }
}

/** Both members of the union are assignable to the exported toggle type. */
const staticToggle: McpCapabilityToggle = false;
const gateToggle: McpCapabilityToggle = AdminGate;

@Resolver('dynamic')
class DynamicResolver {
  @Tool({ name: 'always_off_tool', enabled: false })
  alwaysOffTool(): CallToolResult {
    return { content: [{ type: 'text', text: 'off' }] };
  }

  @Tool({
    name: 'gated_tool',
    description: 'Only for admins',
    paramsSchema: z.object({ id: z.string() }),
    enabled: AdminGate,
  })
  gatedTool(): CallToolResult {
    return { content: [{ type: 'text', text: 'gated' }] };
  }

  @Tool({ name: 'debug_tool', enabled: DebugGate })
  debugTool(): CallToolResult {
    return { content: [{ type: 'text', text: 'debug' }] };
  }

  @Resource({
    name: 'gated_resource',
    uri: 'resource://example/secret',
    enabled: AdminGate,
  })
  gatedResource() {
    return { contents: [] };
  }

  @Prompt({ name: 'always_off_prompt', enabled: false })
  alwaysOffPrompt() {
    return { messages: [] };
  }
}

const contextWith = (
  headers: Record<string, string>,
  clientId?: string,
): McpRegistrationContext =>
  ({
    request: { headers },
    authInfo: clientId
      ? { token: 't', clientId, scopes: ['admin'] }
      : undefined,
  }) as unknown as McpRegistrationContext;

describe('enabled capability gate (consumer call site)', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('carries a static "enabled" into @Tool metadata', () => {
    const metadata = reflector.get(
      MCP_TOOL,
      DynamicResolver.prototype.alwaysOffTool,
    );

    expect(metadata).toEqual({
      name: 'always_off_tool',
      enabled: false,
      methodName: 'alwaysOffTool',
    });
  });

  it('carries a gate class "enabled" into @Tool metadata', () => {
    const metadata = reflector.get(
      MCP_TOOL,
      DynamicResolver.prototype.gatedTool,
    );

    expect(metadata.name).toBe('gated_tool');
    // The class reference itself travels through `SetMetadata`'s spread — the
    // registry resolves it from the container, it is never called directly.
    expect(metadata.enabled).toBe(AdminGate);
  });

  it('carries a gate class into @Resource metadata', () => {
    const metadata = reflector.get(
      MCP_RESOURCE,
      DynamicResolver.prototype.gatedResource,
    );

    expect(metadata.name).toBe('gated_resource');
    expect(metadata.enabled).toBe(AdminGate);
  });

  it('carries "enabled" into @Prompt metadata', () => {
    const metadata = reflector.get(
      MCP_PROMPT,
      DynamicResolver.prototype.alwaysOffPrompt,
    );

    expect(metadata).toEqual({
      name: 'always_off_prompt',
      enabled: false,
      methodName: 'alwaysOffPrompt',
    });
  });

  it('accepts both members of McpCapabilityToggle', () => {
    expect(staticToggle).toBe(false);
    expect(gateToggle).toBe(AdminGate);
  });

  it('answers asynchronously from an injected dependency', async () => {
    const gate = new AdminGate(new PermissionsService());

    await expect(gate.isEnabled(contextWith({}, 'admin-client'))).resolves.toBe(
      true,
    );
    await expect(gate.isEnabled(contextWith({}, 'other-client'))).resolves.toBe(
      false,
    );
    await expect(
      gate.isEnabled(contextWith({ 'x-role': 'admin' })),
    ).resolves.toBe(true);
  });

  it('accepts a gate that answers synchronously', () => {
    const gate = new DebugGate();

    expect(gate.isEnabled(contextWith({ 'x-debug': 'on' }))).toBe(true);
    expect(gate.isEnabled(contextWith({}))).toBe(false);
  });
});
