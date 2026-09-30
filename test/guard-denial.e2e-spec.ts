import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import { AppModule } from '../examples/guards/app.module';
import { e2eLogger } from './support/logger';

/**
 * A guard denial answers the caller without naming the implementation.
 *
 * The denied call reaches the client as an `isError` tool result carrying the
 * thrown message, so that message must not carry the resolver method or the
 * guard class — an unauthorized caller could otherwise map internal names by
 * probing. The operator still gets both from the log.
 */

const ENVELOPE = {
  'io.modelcontextprotocol/clientInfo': { name: 'guard-e2e', version: '1' },
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

interface CallBody {
  result?: {
    content?: { type: string; text: string }[];
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

describe('Guard denial (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = fixture.createNestApplication({ logger: e2eLogger() });
    await app.listen(0);

    const server = app.getHttpServer() as Server;
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses a denied call without naming the method or the guard', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/call',
        'Mcp-Name': 'auth_protected_tool',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'auth_protected_tool', arguments: {}, _meta: ENVELOPE },
      }),
    });

    const raw = await response.text();
    const body = JSON.parse(raw) as CallBody;

    expect(body.result?.isError).toBe(true);
    expect(body.result?.content?.[0]?.text).toBe('Access denied');
    expect(raw).not.toContain('authProtectedTool');
    expect(raw).not.toContain('AuthHeaderGuard');
  });
});
