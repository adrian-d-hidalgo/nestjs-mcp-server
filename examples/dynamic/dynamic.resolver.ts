import {
  CallToolResult,
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/server';
import { z } from 'zod';

import { Prompt, McpContext, Resolver, Resource, Tool } from '../../src';
import {
  AdminGate,
  BetaGate,
  RejectingGate,
  ThrowingGate,
  UnresolvableGate,
} from './capability.gates';

const SearchParams = z.object({ query: z.string() });
type SearchParamsType = z.infer<typeof SearchParams>;

@Resolver('dynamic')
export class DynamicResolver {
  /**
   * Control: no `enabled` option at all. Behaves exactly as it did before the
   * option existed — always registered, always enabled, and it costs the
   * connection no container lookup and no awaited work.
   */
  @Tool({
    name: 'public_tool',
    description: 'Always available, on every connection',
  })
  publicTool(_ctx: McpContext): CallToolResult {
    return { content: [{ type: 'text', text: 'public_tool' }] };
  }

  /**
   * Static toggle. Registered and then disabled, so calling it answers
   * "Tool always_off_tool disabled" rather than "not found". Needs no gate
   * class, no provider and no `await`.
   */
  @Tool({
    name: 'always_off_tool',
    description: 'Disabled for every connection',
    enabled: false,
  })
  alwaysOffTool(_ctx: McpContext): CallToolResult {
    return { content: [{ type: 'text', text: 'always_off_tool' }] };
  }

  /**
   * The headline case: a gate class with an **injected service**, answering
   * **asynchronously**. Connect with `x-role: admin` and this tool appears in
   * `tools/list`; connect without it and it does not.
   */
  @Tool({
    name: 'admin_only_tool',
    description: 'Only advertised to connections that look like an admin',
    paramsSchema: SearchParams,
    enabled: AdminGate,
  })
  adminOnlyTool(params: SearchParamsType, _ctx: McpContext): CallToolResult {
    return {
      content: [
        { type: 'text', text: `admin_only_tool: ${JSON.stringify(params)}` },
      ],
    };
  }

  /**
   * A slow gate, sharing `PermissionsService` with `AdminGate`. Both settle in
   * the same concurrency wave, so the connection pays the slowest gate rather
   * than the sum — and `PermissionsService` is resolved from the container
   * once per connection, not once per capability.
   */
  @Tool({
    name: 'beta_tool',
    description: 'Gated on a deliberately slow lookup',
    enabled: BetaGate,
  })
  betaTool(_ctx: McpContext): CallToolResult {
    return { content: [{ type: 'text', text: 'beta_tool' }] };
  }

  /**
   * A gate that throws synchronously. Fails **closed** — disabled, logged, and
   * every other capability still registers.
   */
  @Tool({
    name: 'throwing_gate_tool',
    description: 'Its gate throws, so it is never available',
    enabled: ThrowingGate,
  })
  throwingGateTool(_ctx: McpContext): CallToolResult {
    return { content: [{ type: 'text', text: 'throwing_gate_tool' }] };
  }

  /**
   * A gate whose promise **rejects**. A different code path from the throw
   * above, and equally fail-closed.
   */
  @Tool({
    name: 'rejecting_gate_tool',
    description: 'Its gate rejects, so it is never available',
    enabled: RejectingGate,
  })
  rejectingGateTool(_ctx: McpContext): CallToolResult {
    return { content: [{ type: 'text', text: 'rejecting_gate_tool' }] };
  }

  /**
   * A gate class the container cannot resolve — it is in no module's
   * `providers` and depends on a token nothing provides. Fails **closed**, and
   * the log line names the capability and the gate so the cause is findable.
   */
  @Tool({
    name: 'unresolvable_gate_tool',
    description: 'Its gate cannot be resolved, so it is never available',
    enabled: UnresolvableGate,
  })
  unresolvableGateTool(_ctx: McpContext): CallToolResult {
    return { content: [{ type: 'text', text: 'unresolvable_gate_tool' }] };
  }

  /** Control prompt: no `enabled` option. */
  @Prompt({
    name: 'public_prompt',
    description: 'Always available',
  })
  publicPrompt(): GetPromptResult {
    return {
      messages: [
        {
          role: 'assistant',
          content: { type: 'text', text: 'Anyone may read this prompt.' },
        },
      ],
    };
  }

  /** Prompts honour the toggle through their own registration path. */
  @Prompt({
    name: 'always_off_prompt',
    description: 'Disabled for every connection',
    enabled: false,
  })
  alwaysOffPrompt(): GetPromptResult {
    return {
      messages: [
        {
          role: 'assistant',
          content: { type: 'text', text: 'Nobody should ever read this.' },
        },
      ],
    };
  }

  /** Prompts accept a gate class too, not only a static toggle. */
  @Prompt({
    name: 'admin_only_prompt',
    description: 'Only advertised to connections that look like an admin',
    enabled: AdminGate,
  })
  adminOnlyPrompt(): GetPromptResult {
    return {
      messages: [
        {
          role: 'assistant',
          content: { type: 'text', text: 'Admin-only prompt.' },
        },
      ],
    };
  }

  /** Control resource: no `enabled` option. */
  @Resource({
    name: 'public_resource',
    uri: 'dynamic://public',
  })
  publicResource(uri: URL): ReadResourceResult {
    return {
      contents: [{ uri: uri.href, text: 'Anyone may read this resource.' }],
    };
  }

  /** Resources honour the toggle through their own registration path. */
  @Resource({
    name: 'always_off_resource',
    uri: 'dynamic://secret',
    enabled: false,
  })
  alwaysOffResource(uri: URL): ReadResourceResult {
    return {
      contents: [{ uri: uri.href, text: 'Nobody should ever read this.' }],
    };
  }

  /** Resources accept a gate class too. */
  @Resource({
    name: 'admin_only_resource',
    uri: 'dynamic://admin',
    enabled: AdminGate,
  })
  adminOnlyResource(uri: URL): ReadResourceResult {
    return {
      contents: [{ uri: uri.href, text: 'Admin-only resource.' }],
    };
  }
}
