import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { AppModule } from '../examples/tools/app.module';

/**
 * The acceptance proof for issue #121.
 *
 * > "I am unable to scale my MCP server across pods behind a load balancer due
 * > to session state being in-memory."
 *
 * Two independently constructed Nest applications — two DI containers, two
 * ports, zero shared memory — with a round-robin dispatcher in front. One MCP
 * client drives a whole conversation across both.
 *
 * The dispatcher is the transport's own `fetch` hook rather than a proxy
 * process: it re-targets every request with no affinity of any kind, which is
 * the behaviour a round-robin load balancer has, while keeping the suite from
 * standing up a cleartext listener of its own.
 *
 * The client is `@modelcontextprotocol/sdk@1`, i.e. **the generation consumers
 * already have**. It is served on the single `/mcp` endpoint through the SDK's
 * stateless legacy fallback, so this proves the fix reaches existing clients
 * rather than only 2026-07-28 ones.
 *
 * Against the published 1.0.1 the same harness fails on the second request
 * with `Bad Request: No valid session ID provided`.
 */
describe('Stateless load balancing (e2e)', () => {
  let appA: INestApplication;
  let appB: INestApplication;

  /** Which instance served each request, in order. */
  let routed: string[];
  /** Any `Mcp-Session-Id` seen crossing the wire, in either direction. */
  let sessionHeaders: string[];
  let upstreams: { label: string; origin: string; alive: boolean }[];
  let next = 0;

  const boot = async (): Promise<{ app: INestApplication; origin: string }> => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = fixture.createNestApplication();
    await app.listen(0);

    const httpServer = app.getHttpServer() as Server;
    const { port } = httpServer.address() as AddressInfo;
    return { app, origin: `http://localhost:${port}` };
  };

  /**
   * Strict round robin over the live instances. No cookie, no affinity, no
   * inspection of the body — exactly the deployment the issue asks for.
   */
  const roundRobin = async (
    input: string | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const live = upstreams.filter((u) => u.alive);
    const target = live[next++ % live.length];
    routed.push(target.label);

    const original = new URL(input.toString());
    const rewritten = `${target.origin}${original.pathname}${original.search}`;

    const sent = new Headers(init?.headers);
    const sentSession = sent.get('mcp-session-id');
    if (sentSession) sessionHeaders.push(sentSession);

    const response = await fetch(rewritten, init);

    const received = response.headers.get('mcp-session-id');
    if (received) sessionHeaders.push(received);

    return response;
  };

  beforeAll(async () => {
    const a = await boot();
    const b = await boot();
    appA = a.app;
    appB = b.app;

    routed = [];
    sessionHeaders = [];
    upstreams = [
      { label: 'A', origin: a.origin, alive: true },
      { label: 'B', origin: b.origin, alive: true },
    ];
  });

  afterAll(async () => {
    if (upstreams[0].alive) await appA.close();
    if (upstreams[1].alive) await appB.close();
  });

  const connect = async () => {
    const client = new Client({ name: 'lb-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      // Any origin: every request is re-targeted by the dispatcher above.
      new URL('http://localhost/mcp'),
      { fetch: roundRobin },
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
