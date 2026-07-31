import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { AppModule } from '../examples/tools/app.module';

/**
 * Both protocol eras against the single `/mcp` endpoint.
 *
 * The 2026-07-28 ("modern") era is driven with raw HTTP rather than a client
 * SDK, deliberately: as of `@modelcontextprotocol/client@2.0.0` the published
 * `StreamableHTTPClientTransport` still negotiates the 2025 era and has no
 * option to select the modern one, so no SDK can exercise this path. Raw
 * requests are the only way to prove the server actually speaks 2026-07-28.
 *
 * The legacy era is driven with the real v2 client, proving the current client
 * generation keeps working through the SDK's stateless fallback.
 */

/**
 * The `_meta` envelope a 2026-07-28 request carries in place of the retired
 * `initialize` handshake. All three keys are required — omitting
 * `clientCapabilities` yields `-32602 Invalid _meta envelope`.
 */
const ENVELOPE = {
  'io.modelcontextprotocol/clientInfo': { name: 'e2e', version: '1.0.0' },
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

interface JsonRpcResponse {
  result?: {
    tools?: { name: string }[];
    content?: { type: string; text: string }[];
    supportedVersions?: string[];
  };
  error?: { code: number; message: string };
}

describe('Protocol eras (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = fixture.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as Server;
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  const modernCall = async (
    method: string,
    params: { name?: string; arguments?: Record<string, unknown> } = {},
    id = 1,
  ): Promise<{
    status: number;
    sessionId: string | null;
    body: JsonRpcResponse;
  }> => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        // Header-based routing (SEP-2243): a gateway can route and authorize
        // on these without parsing the JSON body.
        'Mcp-Method': method,
        'Mcp-Name': params.name ?? '',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params: { ...params, _meta: ENVELOPE },
      }),
    });

    return {
      status: response.status,
      sessionId: response.headers.get('mcp-session-id'),
      body: (await response.json()) as JsonRpcResponse,
    };
  };

  describe('2026-07-28 (modern)', () => {
    it('serves tools/list with no handshake and no session', async () => {
      const { status, sessionId, body } = await modernCall('tools/list');

      expect(status).toBe(200);
      expect(sessionId).toBeNull();
      expect(body.result?.tools?.length).toBeGreaterThan(0);
    });

    it('serves tools/call as a standalone, self-describing request', async () => {
      // The core of issue #121: no prior `initialize`, no session id, so this
      // request could have landed on any instance behind a load balancer.
      const { status, sessionId, body } = await modernCall(
        'tools/call',
        { name: 'tool_with_params_schema', arguments: { value: 'modern' } },
        2,
      );

      expect(status).toBe(200);
      expect(sessionId).toBeNull();
      expect(body.result?.content?.[0]?.text).toContain(
        'ToolWithParamsSchemaOptions',
      );
    });

    it('reports 2026-07-28 from server/discover', async () => {
      const { body } = await modernCall('server/discover', {}, 3);

      // The authoritative check. Note the SDK's exported
      // `LATEST_PROTOCOL_VERSION` is the *legacy* constant ("2025-11-25") —
      // asserting on it would silently pass a false test.
      expect(body.result?.supportedVersions).toContain('2026-07-28');
    });

    it('answers 405 to the retired session operations', async () => {
      // GET and DELETE were the 2025-era session operations. With sessions
      // gone there is nothing for them to address.
      const get = await fetch(`${baseUrl}/mcp`);
      const del = await fetch(`${baseUrl}/mcp`, { method: 'DELETE' });

      expect(get.status).toBe(405);
      expect(del.status).toBe(405);
    });

    it('rejects an incomplete _meta envelope', async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2026-07-28',
          'Mcp-Method': 'tools/list',
          'Mcp-Name': '',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 9,
          method: 'tools/list',
          params: {
            _meta: {
              'io.modelcontextprotocol/clientInfo': {
                name: 'e2e',
                version: '1.0.0',
              },
              'io.modelcontextprotocol/protocolVersion': '2026-07-28',
              // clientCapabilities deliberately omitted
            },
          },
        }),
      });

      const body = (await response.json()) as JsonRpcResponse;
      expect(body.error?.message).toContain('_meta envelope');
    });
  });

  describe('2025 era (legacy fallback)', () => {
    it('serves the current v2 client generation', async () => {
      const client = new Client({ name: 'v2-client', version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/mcp`),
      );

      try {
        await client.connect(transport);

        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toContain('tool_with_params_schema');

        const result = await client.callTool({
          name: 'tool_with_params_schema',
          arguments: { value: 'legacy' },
        });
        expect(result.content).toBeDefined();
      } finally {
        await transport.close();
      }
    });
  });
});
