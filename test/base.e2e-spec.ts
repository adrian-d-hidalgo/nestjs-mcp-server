import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';

import { AppModule } from '../examples/tools/app.module';

describe('AppController (e2e)', () => {
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
    it('should connect using streamable client', async () => {
      const client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0',
      });

      const url = new URL(`${baseUrl}/mcp`);
      const transport = new StreamableHTTPClientTransport(url);

      await client.connect(transport);
      expect(client).toBeDefined();

      await transport.close();
    });

    it('should list available tools', async () => {
      const client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0',
      });

      const url = new URL(`${baseUrl}/mcp`);
      const transport = new StreamableHTTPClientTransport(url);

      await client.connect(transport);

      const tools = await client.listTools();

      expect(tools).toBeDefined();
      expect(tools.tools).toBeInstanceOf(Array);
      expect(tools.tools.length).toBeGreaterThan(0);

      const baseTool = tools.tools.find((t) => t.name === 'tool_base');
      expect(baseTool).toBeDefined();

      const paramsTool = tools.tools.find(
        (t) => t.name === 'tool_with_params_schema',
      );
      expect(paramsTool).toBeDefined();
      expect(paramsTool?.inputSchema).toBeDefined();

      await transport.close();
    });

    it('should call tool_base without parameters', async () => {
      const client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0',
      });

      const url = new URL(`${baseUrl}/mcp`);
      const transport = new StreamableHTTPClientTransport(url);

      await client.connect(transport);

      const result = (await client.callTool({
        name: 'tool_base',
        arguments: {},
      })) as CallToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect((result.content[0] as TextContent).text).toBe('ToolBaseOptions');

      await transport.close();
    });

    it('should call tool with validated parameters', async () => {
      const client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0',
      });

      const url = new URL(`${baseUrl}/mcp`);
      const transport = new StreamableHTTPClientTransport(url);

      await client.connect(transport);

      const result = (await client.callTool({
        name: 'tool_with_params_schema',
        arguments: { value: 'test-value' },
      })) as CallToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect((result.content[0] as TextContent).text).toBe(
        'ToolWithParamsSchemaOptions',
      );

      await transport.close();
    });

    it('should call tool with description', async () => {
      const client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0',
      });

      const url = new URL(`${baseUrl}/mcp`);
      const transport = new StreamableHTTPClientTransport(url);

      await client.connect(transport);

      const result = (await client.callTool({
        name: 'tool_with_description',
        arguments: {},
      })) as CallToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeInstanceOf(Array);
      expect((result.content[0] as TextContent).text).toBe(
        'ToolWithDescriptionOptions',
      );

      await transport.close();
    });

    it('should call tool with annotations', async () => {
      const client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0',
      });

      const url = new URL(`${baseUrl}/mcp`);
      const transport = new StreamableHTTPClientTransport(url);

      await client.connect(transport);

      const result = (await client.callTool({
        name: 'tool_with_annotations',
        arguments: {},
      })) as CallToolResult;

      expect(result).toBeDefined();
      expect((result.content[0] as TextContent).text).toBe(
        'ToolWithAnnotationsOptions',
      );

      await transport.close();
    });

    it('should reject invalid parameters with Zod validation error', async () => {
      const client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0',
      });

      const url = new URL(`${baseUrl}/mcp`);
      const transport = new StreamableHTTPClientTransport(url);

      await client.connect(transport);

      const result = (await client.callTool({
        name: 'tool_with_params_schema',
        arguments: { value: 123 },
      })) as CallToolResult;

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);

      await transport.close();
    });

    it('should reject missing required parameters', async () => {
      const client = new Client({
        name: 'streamable-http-client',
        version: '1.0.0',
      });

      const url = new URL(`${baseUrl}/mcp`);
      const transport = new StreamableHTTPClientTransport(url);

      await client.connect(transport);

      const result = (await client.callTool({
        name: 'tool_with_params_schema',
        arguments: {},
      })) as CallToolResult;

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);

      await transport.close();
    });
  });

  describe('SSE Transport', () => {
    it('should connect, list tools and call tool via SSE', async () => {
      const client = new Client({
        name: 'sse-client',
        version: '1.0.0',
      });

      const url = new URL(`${baseUrl}/sse`);
      const sseTransport = new SSEClientTransport(url);

      await client.connect(sseTransport);
      expect(client).toBeDefined();

      const tools = await client.listTools();
      expect(tools).toBeDefined();
      expect(tools.tools).toBeInstanceOf(Array);
      expect(tools.tools.length).toBeGreaterThan(0);

      const result = (await client.callTool({
        name: 'tool_base',
        arguments: {},
      })) as CallToolResult;

      expect(result).toBeDefined();
      expect(result.content).toBeInstanceOf(Array);
      expect((result.content[0] as TextContent).text).toBe('ToolBaseOptions');

      await sseTransport.close();
    });
  });
});
