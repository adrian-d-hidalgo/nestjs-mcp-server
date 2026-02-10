import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';

import { AppModule } from '../examples/tools/app.module';

describe('Multi-Session (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as Server;
    const address = server.address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Streamable HTTP Transport', () => {
    it('should handle two concurrent sessions without hanging', async () => {
      const client1 = new Client({
        name: 'streamable-client-1',
        version: '1.0.0',
      });

      const transport1 = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/mcp`),
      );

      await client1.connect(transport1);

      const client2 = new Client({
        name: 'streamable-client-2',
        version: '1.0.0',
      });

      const transport2 = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/mcp`),
      );

      await client2.connect(transport2);

      // Call tool on the FIRST session (created before second)
      const result1 = (await client1.callTool({
        name: 'tool_base',
        arguments: {},
      })) as CallToolResult;

      expect(result1).toBeDefined();
      expect(result1.content).toBeInstanceOf(Array);
      expect((result1.content[0] as TextContent).text).toBe('ToolBaseOptions');

      // Call tool on the SECOND session (should also work)
      const result2 = (await client2.callTool({
        name: 'tool_base',
        arguments: {},
      })) as CallToolResult;

      expect(result2).toBeDefined();
      expect(result2.content).toBeInstanceOf(Array);
      expect((result2.content[0] as TextContent).text).toBe('ToolBaseOptions');

      await transport1.close();
      await transport2.close();
    });

    it('should handle three concurrent sessions calling tools in any order', async () => {
      const clients: Client[] = [];
      const transports: StreamableHTTPClientTransport[] = [];

      // Create 3 sessions sequentially
      for (let i = 0; i < 3; i++) {
        const client = new Client({
          name: `streamable-client-${i}`,
          version: '1.0.0',
        });

        const transport = new StreamableHTTPClientTransport(
          new URL(`${baseUrl}/mcp`),
        );

        await client.connect(transport);

        clients.push(client);
        transports.push(transport);
      }

      // Call tool on the FIRST session (oldest)
      const result1 = (await clients[0].callTool({
        name: 'tool_base',
        arguments: {},
      })) as CallToolResult;

      expect((result1.content[0] as TextContent).text).toBe('ToolBaseOptions');

      // Call tool on the SECOND session (middle)
      const result2 = (await clients[1].callTool({
        name: 'tool_base',
        arguments: {},
      })) as CallToolResult;

      expect((result2.content[0] as TextContent).text).toBe('ToolBaseOptions');

      // Call tool on the THIRD session (newest)
      const result3 = (await clients[2].callTool({
        name: 'tool_base',
        arguments: {},
      })) as CallToolResult;

      expect((result3.content[0] as TextContent).text).toBe('ToolBaseOptions');

      for (const transport of transports) {
        await transport.close();
      }
    });
  });

  describe('SSE Transport', () => {
    it('should handle two concurrent SSE sessions without hanging', async () => {
      const client1 = new Client({
        name: 'sse-client-1',
        version: '1.0.0',
      });

      const sseTransport1 = new SSEClientTransport(new URL(`${baseUrl}/sse`));

      await client1.connect(sseTransport1);

      const client2 = new Client({
        name: 'sse-client-2',
        version: '1.0.0',
      });

      const sseTransport2 = new SSEClientTransport(new URL(`${baseUrl}/sse`));
      await client2.connect(sseTransport2);

      // Call tool on the FIRST SSE session
      const result1 = (await client1.callTool({
        name: 'tool_base',
        arguments: {},
      })) as CallToolResult;

      expect(result1).toBeDefined();
      expect((result1.content[0] as TextContent).text).toBe('ToolBaseOptions');

      // Call tool on the SECOND SSE session
      const result2 = (await client2.callTool({
        name: 'tool_base',
        arguments: {},
      })) as CallToolResult;

      expect(result2).toBeDefined();
      expect((result2.content[0] as TextContent).text).toBe('ToolBaseOptions');

      await sseTransport1.close();
      await sseTransport2.close();
    });
  });
});
