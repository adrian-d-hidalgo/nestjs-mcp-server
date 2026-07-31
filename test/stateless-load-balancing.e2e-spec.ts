import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import http, { Server } from 'http';
import { AddressInfo } from 'net';

import { AppModule } from '../examples/tools/app.module';

/**
 * The acceptance proof for issue #121.
 *
 * > "I am unable to scale my MCP server across pods behind a load balancer due
 * > to session state being in-memory."
 *
 * Two independently constructed Nest applications — two DI containers, two
 * ports, zero shared memory — sit behind a strict round-robin proxy with no
 * affinity, no cookie and no header inspection. One MCP client drives a whole
 * conversation through it.
 *
 * A proxy rather than a client-side `fetch` override on purpose: it depends on
 * no client internals and is literally the deployment the issue describes.
 *
 * The client is `@modelcontextprotocol/sdk@1`, i.e. **the generation consumers
 * already have**. It is served on the single `/mcp` endpoint through the SDK's
 * stateless legacy fallback, so this proves the fix reaches existing clients
 * rather than only 2026-07-28 ones.
 *
 * Against 1.0.1 the second assertion fails with
 * `Bad Request: No valid session ID provided`.
 */
describe('Stateless load balancing (e2e)', () => {
  let appA: INestApplication;
  let appB: INestApplication;
  let proxy: http.Server;
  let baseUrl: string;

  /** Which upstream served each proxied request, in order. */
  let routed: string[];
  /** Any `Mcp-Session-Id` seen crossing the wire, in either direction. */
  let sessionHeaders: string[];
  let upstreams: { label: string; port: number; alive: boolean }[];
  let next = 0;

  const boot = async (): Promise<{ app: INestApplication; port: number }> => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = fixture.createNestApplication();
    await app.listen(0);

    const httpServer = app.getHttpServer() as Server;
    const port = (httpServer.address() as AddressInfo).port;
    return { app, port };
  };

  beforeAll(async () => {
    const a = await boot();
    const b = await boot();
    appA = a.app;
    appB = b.app;

    routed = [];
    sessionHeaders = [];
    upstreams = [
      { label: 'A', port: a.port, alive: true },
      { label: 'B', port: b.port, alive: true },
    ];

    proxy = http.createServer((clientReq, clientRes) => {
      // Strict round robin over the live upstreams. No affinity of any kind.
      const live = upstreams.filter((u) => u.alive);
      const target = live[next++ % live.length];
      routed.push(target.label);

      if (clientReq.headers['mcp-session-id']) {
        sessionHeaders.push(String(clientReq.headers['mcp-session-id']));
      }

      const proxied = http.request(
        {
          port: target.port,
          path: clientReq.url,
          method: clientReq.method,
          headers: clientReq.headers,
        },
        (upstreamRes) => {
          if (upstreamRes.headers['mcp-session-id']) {
            sessionHeaders.push(String(upstreamRes.headers['mcp-session-id']));
          }
          clientRes.writeHead(
            upstreamRes.statusCode ?? 502,
            upstreamRes.headers,
          );
          upstreamRes.pipe(clientRes);
        },
      );

      proxied.on('error', () => {
        clientRes.writeHead(502).end();
      });

      clientReq.pipe(proxied);
    });

    await new Promise<void>((resolve) => proxy.listen(0, resolve));
    baseUrl = `http://localhost:${(proxy.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    if (upstreams[0].alive) await appA.close();
    if (upstreams[1].alive) await appB.close();
  });

  const connect = async () => {
    const client = new Client({ name: 'lb-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp`),
    );
    await client.connect(transport);
    return { client, close: () => transport.close() };
  };

  it('serves a whole conversation with requests alternating across instances', async () => {
    const before = routed.length;
    const { client, close } = await connect();

    try {
      for (let i = 0; i < 6; i += 1) {
        const result = await client.callTool({
          name: 'tool_with_params_schema',
          arguments: { value: `call-${i}` },
        });
        expect(result.content).toBeDefined();
      }

      const used = new Set(routed.slice(before));

      // Without this the suite could pass vacuously on a single instance.
      expect(used).toEqual(new Set(['A', 'B']));
    } finally {
      await close();
    }
  });

  it('never issues or requires a session id', async () => {
    const { client, close } = await connect();

    try {
      await client.listTools();
      await client.callTool({
        name: 'tool_with_params_schema',
        arguments: { value: 'x' },
      });

      // The negative that makes the positives mean something: with a session
      // id in play, round-robin routing could only work by accident.
      expect(sessionHeaders).toEqual([]);
    } finally {
      await close();
    }
  });

  it('survives an instance dying mid-conversation', async () => {
    const { client, close } = await connect();

    try {
      await client.callTool({
        name: 'tool_with_params_schema',
        arguments: { value: 'before' },
      });

      // Pod restart: the instance that served the previous call goes away.
      upstreams[0].alive = false;
      await appA.close();

      const result = await client.callTool({
        name: 'tool_with_params_schema',
        arguments: { value: 'after' },
      });

      expect(result.content).toBeDefined();
    } finally {
      await close();
    }
  });
});
