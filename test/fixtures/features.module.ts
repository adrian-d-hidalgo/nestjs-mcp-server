import { Module } from '@nestjs/common';
import { z } from 'zod';

import {
  acceptedContent,
  CallToolResult,
  createRequestStateCodec,
  InputRequiredResult,
  inputRequired,
  McpContext,
  McpModule,
  ReadResourceResult,
  Resolver,
  Resource,
  Tool,
} from '../../src';

/**
 * Seals and verifies the state an MRTR handler carries across a round trip.
 *
 * The HMAC key is what makes the state *verifiable* rather than merely opaque —
 * `requestState` round-trips through the client, so it is attacker-controlled
 * input. The SDK applies no integrity protection by default.
 *
 * The key must be identical on every instance that might receive the echoed
 * value, which is precisely what lets a retry land on a different pod. In a
 * real deployment it comes from config; here it is a literal ≥32 bytes, which
 * the codec enforces with a `RangeError`.
 */
const STATE_CODEC = createRequestStateCodec<{ item: string }>({
  key: 'a-shared-hmac-key-of-at-least-32-bytes!!',
});

/**
 * A resolver exercising the 2026-07-28 capability surface: multi-round-trip
 * input, structured output, display metadata, and resource cache hints.
 *
 * Not exported: it is only referenced by the modules below, in this same file.
 */
@Resolver('features')
class FeaturesResolver {
  /**
   * Multi Round-Trip Requests.
   *
   * On the first call there is no answer in `ctx.mcpReq.inputResponses`, so the
   * handler returns `input_required` describing what it needs. The client
   * re-sends the same call with the answer attached, and this time the handler
   * completes. This replaces the 2025-era server-initiated `elicitation/create`,
   * which needed a held-open bidirectional stream and therefore a session.
   */
  @Tool({
    name: 'deploy',
    description: 'Deploys after confirming with the caller',
    paramsSchema: z.object({ env: z.string() }),
  })
  deploy(
    params: { env: string },
    ctx: McpContext,
  ): CallToolResult | InputRequiredResult {
    const answer = acceptedContent<{ confirm: boolean }>(
      ctx.mcpReq.inputResponses,
      'confirm',
    );

    if (!answer) {
      return inputRequired({
        inputRequests: {
          confirm: inputRequired.elicit({
            message: `Deploy to ${params.env}?`,
            requestedSchema: {
              type: 'object',
              properties: { confirm: { type: 'boolean' } },
              required: ['confirm'],
            },
          }),
        },
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: answer.confirm
            ? `deployed to ${params.env}`
            : `cancelled for ${params.env}`,
        },
      ],
    };
  }

  /** Structured output plus display metadata. */
  @Tool({
    name: 'measure',
    title: 'Measure Something',
    description: 'Returns a structured measurement',
    paramsSchema: z.object({ subject: z.string() }),
    outputSchema: z.object({ subject: z.string(), value: z.number() }),
    _meta: { 'com.example/category': 'diagnostics' },
  })
  measure(params: { subject: string }): CallToolResult {
    return {
      content: [{ type: 'text', text: `measured ${params.subject}` }],
      structuredContent: { subject: params.subject, value: 42 },
    };
  }

  /** A resource carrying a cache hint on its read result. */
  @Resource({
    name: 'catalog',
    uri: 'catalog://items',
    cacheHint: { ttlMs: 60_000, cacheScope: 'public' },
  })
  catalog(uri: URL): ReadResourceResult {
    return {
      contents: [{ uri: uri.href, text: JSON.stringify(['a', 'b']) }],
    };
  }
}

@Module({
  imports: [McpModule.forRoot({ name: 'features', version: '1.0.0' })],
  providers: [FeaturesResolver],
})
export class FeaturesModule {}

/** The same resolver behind a modern-only endpoint. */
@Module({
  imports: [
    McpModule.forRoot({
      name: 'features-strict',
      version: '1.0.0',
      transport: { legacy: 'reject' },
    }),
  ],
  providers: [FeaturesResolver],
})
export class StrictModule {}

/** The same resolver with responses forced onto the SSE streaming path. */
@Module({
  imports: [
    McpModule.forRoot({
      name: 'features-sse',
      version: '1.0.0',
      transport: { responseMode: 'sse' },
    }),
  ],
  providers: [FeaturesResolver],
})
export class StreamingModule {}

/**
 * A resolver whose MRTR round trip carries signed `requestState`.
 *
 * The blog post the issue links to makes a specific claim about this: *"Because
 * `requestState` carries everything needed to resume, the retry can land on a
 * completely different server instance."* This fixture is what proves it.
 */
@Resolver('resumable')
class ResumableResolver {
  @Tool({
    name: 'purchase',
    description: 'Confirms a purchase across a round trip',
    paramsSchema: z.object({ item: z.string() }),
  })
  async purchase(
    params: { item: string },
    ctx: McpContext,
  ): Promise<CallToolResult | InputRequiredResult> {
    const answer = acceptedContent<{ confirm: boolean }>(
      ctx.mcpReq.inputResponses,
      'confirm',
    );

    if (!answer) {
      return inputRequired({
        inputRequests: {
          confirm: inputRequired.elicit({
            message: `Buy ${params.item}?`,
            requestedSchema: {
              type: 'object',
              properties: { confirm: { type: 'boolean' } },
              required: ['confirm'],
            },
          }),
        },
        // Sealed here; verified by whichever instance receives the retry.
        requestState: await STATE_CODEC.mint({ item: params.item }),
      });
    }

    // The payload the verify hook decoded — proof the state survived the round
    // trip intact, whichever instance is serving this second call.
    const state = ctx.mcpReq.requestState<{ item: string }>();

    return {
      content: [
        {
          type: 'text',
          text: `bought ${state?.item ?? params.item} (confirmed=${String(answer.confirm)})`,
        },
      ],
    };
  }
}

@Module({
  imports: [
    McpModule.forRoot({
      name: 'resumable',
      version: '1.0.0',
      server: {
        // The seam the SDK calls to validate an echoed requestState.
        // Wrapped rather than passed by reference: a detached method would
        // lose its `this`.
        requestState: {
          verify: (...args: Parameters<typeof STATE_CODEC.verify>) =>
            STATE_CODEC.verify(...args),
        },
      },
    }),
  ],
  providers: [ResumableResolver],
})
export class ResumableModule {}
