import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

/**
 * Every example boots and serves.
 *
 * Only `examples/tools` and `examples/dynamic` back a behavioural e2e; the rest
 * were previously verified by nothing but `tsc` and eslint, so a runtime
 * regression in them — a broken provider graph, a decorator the registry can no
 * longer read — would ship silently.
 *
 * This is deliberately a smoke test: it asserts each example *runs* and answers
 * the protocol, not what its capabilities do. The examples are documentation,
 * and documentation that does not boot is worse than none.
 */

const ENVELOPE = {
  'io.modelcontextprotocol/clientInfo': { name: 'smoke', version: '1.0.0' },
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

interface ListBody {
  result?: {
    tools?: unknown[];
    prompts?: unknown[];
    resources?: unknown[];
  };
  error?: { code: number; message: string };
}

/**
 * `expectsCapabilities: false` for `for-root-async`, which demonstrates
 * `forRootAsync` wiring and registers no resolver at all. It correctly answers
 * `-32601 Method not found` to `tools/list`, because a server with no tools
 * never advertises the `tools` capability.
 */
const EXAMPLES: { dir: string; expectsCapabilities: boolean }[] = [
  { dir: 'tools', expectsCapabilities: true },
  { dir: 'prompts', expectsCapabilities: true },
  { dir: 'resources', expectsCapabilities: true },
  { dir: 'mixed', expectsCapabilities: true },
  { dir: 'guards', expectsCapabilities: true },
  { dir: 'dynamic', expectsCapabilities: true },
  { dir: 'for-root-async', expectsCapabilities: false },
];

describe('Examples smoke (e2e)', () => {
  const list = async (baseUrl: string, method: string): Promise<ListBody> => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': method,
        'Mcp-Name': '',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params: { _meta: ENVELOPE },
      }),
    });

    return (await response.json()) as ListBody;
  };

  it.each(EXAMPLES)(
    'examples/$dir boots and serves the protocol',
    async ({ dir, expectsCapabilities }) => {
      const mod = (await import(`../examples/${dir}/app.module`)) as {
        AppModule: unknown;
      };

      const fixture: TestingModule = await Test.createTestingModule({
        imports: [mod.AppModule as never],
      }).compile();

      const app: INestApplication = fixture.createNestApplication();
      await app.listen(0);

      try {
        const server = app.getHttpServer() as Server;
        const port = (server.address() as AddressInfo).port;
        const baseUrl = `http://localhost:${port}`;

        const [tools, prompts, resources] = await Promise.all([
          list(baseUrl, 'tools/list'),
          list(baseUrl, 'prompts/list'),
          list(baseUrl, 'resources/list'),
        ]);

        const total =
          (tools.result?.tools?.length ?? 0) +
          (prompts.result?.prompts?.length ?? 0) +
          (resources.result?.resources?.length ?? 0);

        if (expectsCapabilities) {
          expect(total).toBeGreaterThan(0);
        } else {
          // No resolver: the server must still boot and answer, it just has
          // nothing to advertise.
          expect(total).toBe(0);
        }
      } finally {
        await app.close();
      }
    },
  );
});
