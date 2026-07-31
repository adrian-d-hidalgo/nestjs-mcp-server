import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import {
  FeaturesModule,
  ResumableModule,
  StreamingModule,
  StrictModule,
} from './fixtures/features.module';

/**
 * The 2026-07-28 capability surface, on the wire.
 *
 * Driven with raw HTTP: no published client SDK speaks the modern era yet, so
 * these paths — MRTR in particular — are unreachable through a client library.
 */

const ENVELOPE = {
  'io.modelcontextprotocol/clientInfo': { name: 'features-e2e', version: '1' },
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

/**
 * MRTR is capability-gated: the server refuses to ask for input a client has
 * not declared it can answer (`-32021`, listing the required capability). A
 * client that wants elicitation must say so on every request.
 */
const ELICIT_ENVELOPE = {
  ...ENVELOPE,
  'io.modelcontextprotocol/clientCapabilities': {
    elicitation: { form: {} },
  },
};

interface ToolDescriptor {
  name: string;
  title?: string;
  outputSchema?: unknown;
  _meta?: Record<string, unknown>;
}

interface RpcBody {
  result?: {
    tools?: ToolDescriptor[];
    content?: { type: string; text: string }[];
    structuredContent?: Record<string, unknown>;
    contents?: { uri: string; text: string }[];
    resultType?: string;
    inputRequests?: Record<string, unknown>;
    requestState?: string;
    ttlMs?: number;
    cacheScope?: string;
  };
  error?: { code: number; message: string };
}

const boot = async (mod: unknown): Promise<[INestApplication, string]> => {
  const fixture: TestingModule = await Test.createTestingModule({
    imports: [mod as never],
  }).compile();

  const app = fixture.createNestApplication();
  await app.listen(0);

  const server = app.getHttpServer() as Server;
  return [app, `http://localhost:${(server.address() as AddressInfo).port}`];
};

const mcpName = (params: Record<string, unknown>): string => {
  if (typeof params.name === 'string') return params.name;
  if (typeof params.uri === 'string') return params.uri;
  return '';
};

const call = async (
  baseUrl: string,
  method: string,
  params: Record<string, unknown> = {},
  id = 1,
  envelope: Record<string, unknown> = ENVELOPE,
): Promise<RpcBody> => {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': method,
      // Header-based routing (SEP-2243): the header must name the same target
      // as the body, or the server answers -32020. For resources that is the
      // URI, not the resource's registered name.
      'Mcp-Name': mcpName(params),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params: { ...params, _meta: envelope },
    }),
  });

  return (await response.json()) as RpcBody;
};

describe('MCP feature surface (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    [app, baseUrl] = await boot(FeaturesModule);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('multi round-trip requests', () => {
    it('returns input_required when the handler needs an answer', async () => {
      const body = await call(
        baseUrl,
        'tools/call',
        { name: 'deploy', arguments: { env: 'prod' } },
        1,
        ELICIT_ENVELOPE,
      );

      // The modern replacement for server-initiated elicitation: no held-open
      // stream, so no session, so it works behind a load balancer.
      expect(body.result?.resultType).toBe('input_required');
      expect(Object.keys(body.result?.inputRequests ?? {})).toContain(
        'confirm',
      );
    });

    it('completes when the client retries with the answer attached', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2026-07-28',
          'Mcp-Method': 'tools/call',
          'Mcp-Name': 'deploy',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'deploy',
            arguments: { env: 'prod' },
            _meta: ELICIT_ENVELOPE,
            // The same call, re-sent with the answers the server asked for.
            inputResponses: {
              confirm: { action: 'accept', content: { confirm: true } },
            },
          },
        }),
      });

      const body = (await response.json()) as RpcBody;

      expect(body.result?.content?.[0]?.text).toBe('deployed to prod');
    });

    it('carries a declined answer through to the handler', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2026-07-28',
          'Mcp-Method': 'tools/call',
          'Mcp-Name': 'deploy',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'deploy',
            arguments: { env: 'staging' },
            _meta: ELICIT_ENVELOPE,
            inputResponses: {
              confirm: { action: 'accept', content: { confirm: false } },
            },
          },
        }),
      });

      const body = (await response.json()) as RpcBody;

      expect(body.result?.content?.[0]?.text).toBe('cancelled for staging');
    });
  });

  describe('tool metadata', () => {
    it('advertises title, outputSchema and _meta on tools/list', async () => {
      const body = await call(baseUrl, 'tools/list', {}, 4);
      const measure = body.result?.tools?.find((t) => t.name === 'measure');

      expect(measure?.title).toBe('Measure Something');
      expect(measure?.outputSchema).toBeDefined();
      expect(measure?._meta).toMatchObject({
        'com.example/category': 'diagnostics',
      });
    });

    it('returns structured content validated against outputSchema', async () => {
      const body = await call(
        baseUrl,
        'tools/call',
        { name: 'measure', arguments: { subject: 'latency' } },
        5,
      );

      expect(body.result?.structuredContent).toEqual({
        subject: 'latency',
        value: 42,
      });
    });
  });

  describe('resource cache hints', () => {
    it('attaches ttlMs and cacheScope to resources/read', async () => {
      const body = await call(
        baseUrl,
        'resources/read',
        { uri: 'catalog://items' },
        6,
      );

      expect(body.result?.contents?.[0]?.text).toContain('a');
      expect(body.result?.ttlMs).toBe(60_000);
      expect(body.result?.cacheScope).toBe('public');
    });
  });
});

describe('legacy: reject (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    [app, baseUrl] = await boot(StrictModule);
  });

  afterAll(async () => {
    await app.close();
  });

  it('still serves modern-era traffic', async () => {
    const body = await call(baseUrl, 'tools/list', {}, 1);

    expect(body.result?.tools?.length).toBeGreaterThan(0);
  });

  it('refuses a 2025-era client with unsupported-protocol-version', async () => {
    const client = new Client({ name: 'v1', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp`),
    );

    // The documented consequence of choosing this mode: every client SDK
    // published today speaks the 2025 era, so `reject` turns them all away.
    // Shipping the option without this test would have hidden that.
    await expect(client.connect(transport)).rejects.toThrow(
      /Unsupported protocol version/,
    );

    await transport.close();
  });
});

describe('responseMode: sse (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    [app, baseUrl] = await boot(StreamingModule);
  });

  afterAll(async () => {
    await app.close();
  });

  it('delivers the result over an SSE stream', async () => {
    // Exercises the streaming half of `toNodeHandler` — the backpressure loop
    // that pumps a web ReadableStream into the Express response. Every other
    // test in this repo takes the single-JSON-body path.
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/call',
        'Mcp-Name': 'measure',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'measure',
          arguments: { subject: 'stream' },
          _meta: ENVELOPE,
        },
      }),
    });

    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const text = await response.text();

    // SSE framing, with the JSON-RPC result inside a data: frame.
    expect(text).toContain('event: message');
    expect(text).toContain('measured stream');
  });
});

describe('MRTR across instances (e2e)', () => {
  let appA: INestApplication;
  let appB: INestApplication;
  let urlA: string;
  let urlB: string;

  beforeAll(async () => {
    [appA, urlA] = await boot(ResumableModule);
    [appB, urlB] = await boot(ResumableModule);
  });

  afterAll(async () => {
    await appA.close();
    await appB.close();
  });

  it('resumes on a different instance than the one that issued the state', async () => {
    // Round 1 on instance A.
    const first = await call(
      urlA,
      'tools/call',
      { name: 'purchase', arguments: { item: 'otters' } },
      1,
      ELICIT_ENVELOPE,
    );

    expect(first.result?.resultType).toBe('input_required');

    const state = first.result?.requestState;
    expect(typeof state).toBe('string');

    // Round 2 on instance B, which has never seen this conversation. It can
    // only serve it because the state is HMAC-sealed with a key both
    // instances hold — the blog's claim that "the retry can land on a
    // completely different server instance" made executable.
    const response = await fetch(`${urlB}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/call',
        'Mcp-Name': 'purchase',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'purchase',
          arguments: { item: 'otters' },
          _meta: ELICIT_ENVELOPE,
          inputResponses: {
            confirm: { action: 'accept', content: { confirm: true } },
          },
          requestState: state,
        },
      }),
    });

    const body = (await response.json()) as RpcBody;

    expect(body.result?.content?.[0]?.text).toBe(
      'bought otters (confirmed=true)',
    );
  });

  it('rejects a tampered requestState', async () => {
    const first = await call(
      urlA,
      'tools/call',
      { name: 'purchase', arguments: { item: 'otters' } },
      3,
      ELICIT_ENVELOPE,
    );

    const tampered = `${String(first.result?.requestState).slice(0, -4)}AAAA`;

    const response = await fetch(`${urlB}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/call',
        'Mcp-Name': 'purchase',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'purchase',
          arguments: { item: 'otters' },
          _meta: ELICIT_ENVELOPE,
          inputResponses: {
            confirm: { action: 'accept', content: { confirm: true } },
          },
          requestState: tampered,
        },
      }),
    });

    const body = (await response.json()) as RpcBody;

    // requestState is attacker-controlled input. Without the verify hook the
    // SDK applies no integrity protection at all, which is why wiring it is
    // the security-relevant half of MRTR.
    expect(body.error).toBeDefined();
    expect(body.result?.content).toBeUndefined();
  });
});
