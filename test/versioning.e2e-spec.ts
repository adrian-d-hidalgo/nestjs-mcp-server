import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { AppModule } from '../examples/auth/app.module';
import { e2eLogger } from './support/logger';

/**
 * Apps that turn on URI versioning must still serve the MCP endpoint and the
 * protected-resource metadata at their unversioned paths: MCP clients are
 * configured with `/mcp`, and RFC 9728 fixes the well-known path.
 */
describe('URI versioning (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: e2eLogger() });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0);

    const address = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the MCP endpoint at /mcp, not /v1/mcp', async () => {
    const client = new Client({ name: 'versioning-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp`),
      { requestInit: { headers: { 'x-api-key': 'demo-read-write-key' } } },
    );

    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain('list_notes');

    await transport.close();
  });

  it('serves protected-resource metadata at its unversioned well-known path', async () => {
    const response = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource/mcp`,
    );

    expect(response.status).toBe(200);
  });
});
