import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { INestApplication, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

import {
  AuthenticatedRequest,
  AuthInfo,
  CallToolResult,
  McpAuthStrategy,
  McpModule,
  ReadResourceResult,
  Resolver,
  Resource,
  Tool,
} from '../src';
import { e2eLogger } from './support/logger';

/**
 * `public` capabilities and `@Resolver({ … })` access defaults through a real
 * HTTP server, for both protocol eras. Split from `auth.e2e-spec.ts`, which
 * covers the authentication path itself.
 */

const RESOURCE = 'https://mcp.example.com/mcp';
const PRM_URL =
  'https://mcp.example.com/.well-known/oauth-protected-resource/mcp';

const ENVELOPE = {
  'io.modelcontextprotocol/clientInfo': { name: 'e2e', version: '1.0.0' },
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

/** `x-api-key: <scope> <scope>…` grants those scopes; no header, no answer. */
@Injectable()
class ScopesFromKeyStrategy implements McpAuthStrategy {
  readonly challenge = 'ApiKey header="x-api-key"';

  authenticate(request: AuthenticatedRequest): AuthInfo | null {
    const key = request.headers['x-api-key'];
    if (typeof key !== 'string') return null;
    return {
      token: key,
      clientId: 'key-client',
      scopes: key.split(' ').filter(Boolean),
    };
  }
}

const text = (value: string): CallToolResult => ({
  content: [{ type: 'text', text: value }],
});

@Resolver('catalog')
class CatalogResolver {
  @Tool({ name: 'search', description: 'Public search', public: true })
  search(): CallToolResult {
    return text('results');
  }

  @Tool({ name: 'whoami', description: 'Any authenticated caller' })
  whoami(): CallToolResult {
    return text('someone');
  }

  @Resource({ name: 'readme', uri: 'docs://readme', public: true })
  readme(uri: URL): ReadResourceResult {
    return { contents: [{ uri: uri.href, text: 'hello' }] };
  }
}

/** Resolver defaults: every tool needs `notes:read` unless it says otherwise. */
@Resolver({ name: 'notes', scopes: ['notes:read'] })
class NotesResolver {
  @Tool({ name: 'list_notes', description: 'Inherits notes:read' })
  listNotes(): CallToolResult {
    return text('[]');
  }

  @Tool({
    name: 'add_note',
    description: 'Replaces with notes:write',
    scopes: ['notes:write'],
  })
  addNote(): CallToolResult {
    return text('added');
  }
}

/** Resolver-level `public`: the whole class is open to anonymous callers. */
@Resolver({ public: true })
class StatusResolver {
  @Tool({ name: 'status', description: 'Public through its resolver' })
  status(): CallToolResult {
    return text('ok');
  }
}

const listen = async (
  providers: (new (...args: never[]) => object)[],
): Promise<{ app: INestApplication; baseUrl: string }> => {
  @Module({
    imports: [
      McpModule.forRoot({
        name: 'public-e2e',
        version: '1.0.0',
        logging: { enabled: false },
        auth: {
          strategies: [ScopesFromKeyStrategy],
          protectedResource: {
            resource: RESOURCE,
            authorizationServers: ['https://auth.example.com'],
            scopesSupported: ['notes:read', 'notes:write'],
          },
        },
      }),
    ],
    providers: [ScopesFromKeyStrategy, ...providers],
  })
  class PublicTestModule {}

  const fixture = await Test.createTestingModule({
    imports: [PublicTestModule],
  }).compile();
  const app = fixture.createNestApplication({ logger: e2eLogger() });
  await app.listen(0);
  const server = app.getHttpServer() as Server;
  return {
    app,
    baseUrl: `http://localhost:${(server.address() as AddressInfo).port}`,
  };
};

interface JsonRpcBody {
  result?: {
    tools?: { name: string }[];
    resources?: { uri: string }[];
    content?: { type: string; text: string }[];
    contents?: { text: string }[];
  };
  error?: { code: number; message: string };
}

const modernCall = (
  baseUrl: string,
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Promise<Response> =>
  fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': method,
      // SEP-2243: `Mcp-Name` mirrors `params.name`, or `params.uri` on a read.
      ...(typeof (params.name ?? params.uri) === 'string'
        ? { 'Mcp-Name': String(params.name ?? params.uri) }
        : {}),
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: { ...params, _meta: ENVELOPE },
    }),
  });

const toolNames = async (response: Response): Promise<string[]> =>
  ((await response.json()) as JsonRpcBody).result?.tools
    ?.map((tool) => tool.name)
    .sort() ?? [];

describe('Public capabilities (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    ({ app, baseUrl } = await listen([
      CatalogResolver,
      NotesResolver,
      StatusResolver,
    ]));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('modern era, anonymous', () => {
    it('lists only public capabilities', async () => {
      const response = await modernCall(baseUrl, 'tools/list');

      expect(response.status).toBe(200);
      expect(await toolNames(response)).toEqual(['search', 'status']);
    });

    it('calls a public tool and reads a public resource', async () => {
      const call = await modernCall(baseUrl, 'tools/call', {
        name: 'search',
        arguments: {},
      });
      const read = await modernCall(baseUrl, 'resources/read', {
        uri: 'docs://readme',
      });

      expect(call.status).toBe(200);
      expect(
        ((await call.json()) as JsonRpcBody).result?.content?.[0]?.text,
      ).toBe('results');
      expect(read.status).toBe(200);
      expect(
        ((await read.json()) as JsonRpcBody).result?.contents?.[0]?.text,
      ).toBe('hello');
    });

    it.each(['whoami', 'list_notes'])(
      'answers 401 with the challenges to a call of protected %s',
      async (name) => {
        const response = await modernCall(baseUrl, 'tools/call', {
          name,
          arguments: {},
        });

        expect(response.status).toBe(401);
        const challenge = response.headers.get('www-authenticate') ?? '';
        expect(challenge).toContain(`resource_metadata="${PRM_URL}"`);
        expect(challenge).toContain('ApiKey header="x-api-key"');
      },
    );

    it('answers 401 to a method outside the public allow-list', async () => {
      const response = await modernCall(baseUrl, 'logging/setLevel', {
        level: 'debug',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('modern era, authenticated', () => {
    it('lists every capability, public ones included', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/list',
        {},
        { 'x-api-key': 'notes:read' },
      );

      expect(await toolNames(response)).toEqual([
        'add_note',
        'list_notes',
        'search',
        'status',
        'whoami',
      ]);
    });

    it('applies the resolver scopes, and the method scopes that replace them', async () => {
      const inherits = await modernCall(
        baseUrl,
        'tools/call',
        { name: 'list_notes', arguments: {} },
        { 'x-api-key': 'notes:write' },
      );
      const replaces = await modernCall(
        baseUrl,
        'tools/call',
        { name: 'add_note', arguments: {} },
        { 'x-api-key': 'notes:write' },
      );

      expect(inherits.status).toBe(403);
      expect(inherits.headers.get('www-authenticate')).toContain(
        'scope="notes:read"',
      );
      expect(replaces.status).toBe(200);
    });

    it('lets an authenticated caller without scopes call a public tool', async () => {
      const response = await modernCall(
        baseUrl,
        'tools/call',
        { name: 'status', arguments: {} },
        { 'x-api-key': 'none' },
      );

      expect(response.status).toBe(200);
    });
  });

  describe('legacy era, @modelcontextprotocol/sdk v1 client', () => {
    it('connects, lists and calls public tools anonymously, then gets 401 on a protected one', async () => {
      const client = new Client({ name: 'v1-anonymous', version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(
        new URL(`${baseUrl}/mcp`),
      );

      try {
        await client.connect(transport);

        const { tools } = await client.listTools();
        expect(tools.map((tool) => tool.name).sort()).toEqual([
          'search',
          'status',
        ]);

        const result = (await client.callTool({
          name: 'search',
          arguments: {},
        })) as CallToolResult;
        expect(result.content[0]).toEqual({ type: 'text', text: 'results' });

        // The v1 transport surfaces the 401 body, not the status.
        await expect(
          client.callTool({ name: 'whoami', arguments: {} }),
        ).rejects.toThrow(/Authentication required/);
      } finally {
        await transport.close();
      }
    });
  });
});

describe('Public capabilities absent (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    ({ app, baseUrl } = await listen([NotesResolver]));
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers an anonymous handshake 401 exactly as before', async () => {
    const client = new Client({ name: 'v1-anonymous', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp`),
    );

    try {
      await expect(client.connect(transport)).rejects.toThrow();
    } finally {
      await transport.close();
    }

    const response = await modernCall(baseUrl, 'tools/list');
    expect(response.status).toBe(401);
  });
});
