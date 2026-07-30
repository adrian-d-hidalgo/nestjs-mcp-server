import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  CallToolResult,
  ErrorCode,
  TextContent,
} from '@modelcontextprotocol/sdk/types';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'http';
import { AddressInfo } from 'net';

import { AppModule } from '../examples/dynamic/app.module';

/**
 * The gate design on the wire, over both transports.
 *
 * The capability set is decided once per connection by classes resolved from
 * the Nest container and awaited, so every case here opens its own connection:
 * that is the unit of behaviour under test. Connections are always closed in a
 * `finally` — a leaked SSE stream keeps reconnecting and hangs `app.close()`.
 */

/** The header `examples/dynamic`'s `AdminGate` keys on. */
const ADMIN_HEADERS: Record<string, string> = { 'x-role': 'admin' };

interface Connection {
  client: Client;
  close: () => Promise<void>;
  /** Every notification method received on this connection, in order. */
  notifications: string[];
}

type Connect = (headers?: Record<string, string>) => Promise<Connection>;

describe('Dynamic capabilities (e2e)', () => {
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

  const newClient = (): { client: Client; notifications: string[] } => {
    const client = new Client({ name: 'dynamic-client', version: '1.0.0' });
    const notifications: string[] = [];

    // Set before connect: a frame emitted during the handshake still lands here.
    client.fallbackNotificationHandler = (notification) => {
      notifications.push(notification.method);
      return Promise.resolve();
    };

    return { client, notifications };
  };

  const connectStreamable: Connect = async (headers) => {
    const { client, notifications } = newClient();
    const transport = new StreamableHTTPClientTransport(
      new URL(`${baseUrl}/mcp`),
      headers ? { requestInit: { headers } } : undefined,
    );

    await client.connect(transport);

    return { client, notifications, close: () => transport.close() };
  };

  const connectSse: Connect = async (headers) => {
    const { client, notifications } = newClient();
    // `requestInit.headers` is merged into the initial `GET /sse` too
    // (SDK `sse.js` `_commonHeaders`), which is the request registration sees.
    const transport = new SSEClientTransport(
      new URL(`${baseUrl}/sse`),
      headers ? { requestInit: { headers } } : undefined,
    );

    await client.connect(transport);

    return { client, notifications, close: () => transport.close() };
  };

  const toolNames = async (connection: Connection): Promise<string[]> => {
    const { tools } = await connection.client.listTools();
    return tools.map((tool) => tool.name);
  };

  const transports = [
    { label: 'Streamable HTTP', connect: connectStreamable },
    { label: 'SSE', connect: connectSse },
  ];

  describe.each(transports)('$label', ({ connect }) => {
    it('omits a statically disabled tool from tools/list', async () => {
      const connection = await connect();

      try {
        const names = await toolNames(connection);

        expect(names).toContain('public_tool');
        expect(names).not.toContain('always_off_tool');
      } finally {
        await connection.close();
      }
    });

    it('omits a tool whose DI-resolved async gate answered false and lists it when the request satisfies the gate', async () => {
      const anonymous = await connect();
      const admin = await connect(ADMIN_HEADERS);

      try {
        // `AdminGate` reaches `PermissionsService` through the container and
        // answers on a later tick. A pending promise is truthy, so an
        // implementation that skipped the await would list this for everyone.
        expect(await toolNames(anonymous)).not.toContain('admin_only_tool');
        expect(await toolNames(admin)).toContain('admin_only_tool');
      } finally {
        await anonymous.close();
        await admin.close();
      }
    });

    it('applies a gate to prompts and resources as well as tools', async () => {
      const anonymous = await connect();
      const admin = await connect(ADMIN_HEADERS);

      try {
        const promptsFor = async (connection: Connection) =>
          (await connection.client.listPrompts()).prompts.map((p) => p.name);
        const resourcesFor = async (connection: Connection) =>
          (await connection.client.listResources()).resources.map(
            (r) => r.name,
          );

        expect(await promptsFor(anonymous)).not.toContain('admin_only_prompt');
        expect(await promptsFor(admin)).toContain('admin_only_prompt');

        expect(await resourcesFor(anonymous)).not.toContain(
          'admin_only_resource',
        );
        expect(await resourcesFor(admin)).toContain('admin_only_resource');
      } finally {
        await anonymous.close();
        await admin.close();
      }
    });

    it('lists a tool whose slow gate answered true, without dropping the fast ones', async () => {
      const connection = await connect();

      try {
        const names = await toolNames(connection);

        // `BetaGate` takes ~100ms and settles in the same wave as the others.
        expect(names).toContain('beta_tool');
        expect(names).toContain('public_tool');
      } finally {
        await connection.close();
      }
    });

    it('fails closed for a gate that throws synchronously, without dropping its siblings', async () => {
      const connection = await connect();

      try {
        const names = await toolNames(connection);

        expect(names).not.toContain('throwing_gate_tool');
        expect(names).toContain('public_tool');
      } finally {
        await connection.close();
      }
    });

    it('fails closed for a gate whose promise rejects', async () => {
      const connection = await connect();

      try {
        const names = await toolNames(connection);

        // Distinct from the synchronous throw above: a try/catch around the
        // call instead of around the await catches that one and misses this.
        expect(names).not.toContain('rejecting_gate_tool');
        expect(names).toContain('public_tool');
      } finally {
        await connection.close();
      }
    });

    it('fails closed for a gate class the container cannot resolve', async () => {
      const connection = await connect();

      try {
        const names = await toolNames(connection);

        // It must not be silently built with `new`: such a gate has undefined
        // dependencies and could answer something accidentally truthy.
        expect(names).not.toContain('unresolvable_gate_tool');
        expect(names).toContain('public_tool');
      } finally {
        await connection.close();
      }
    });

    it('answers a call to a disabled tool with "disabled", not "not found"', async () => {
      const connection = await connect();

      try {
        const result = (await connection.client.callTool({
          name: 'always_off_tool',
          arguments: {},
        })) as CallToolResult;

        // The whole reason the SPEC chose register-then-disable over
        // skip-registration: the client is told the tool exists but is off.
        //
        // Shape note, verified against the pinned SDK 1.30.0: the disabled
        // check throws `McpError(InvalidParams, 'Tool <name> disabled')` at
        // `mcp.js:106-107`, but the surrounding handler catches it and returns
        // it as a tool-error result (`mcp.js:135-141`, `createToolError`)
        // rather than a JSON-RPC error. The distinguishing text is what
        // matters and it is intact.
        expect(result.isError).toBe(true);

        const text = (result.content[0] as TextContent).text;
        expect(text).toContain('Tool always_off_tool disabled');
        expect(text).toContain(String(ErrorCode.InvalidParams));
        expect(text).not.toContain('not found');
      } finally {
        await connection.close();
      }
    });

    it('omits disabled prompts and resources from their lists', async () => {
      const connection = await connect();

      try {
        const { prompts } = await connection.client.listPrompts();
        const { resources } = await connection.client.listResources();

        const promptNames = prompts.map((prompt) => prompt.name);
        expect(promptNames).toContain('public_prompt');
        expect(promptNames).not.toContain('always_off_prompt');

        const resourceNames = resources.map((resource) => resource.name);
        expect(resourceNames).toContain('public_resource');
        expect(resourceNames).not.toContain('always_off_resource');
      } finally {
        await connection.close();
      }
    });

    it('emits no list_changed notification during connect', async () => {
      const connection = await connect(ADMIN_HEADERS);

      try {
        // Registration — and therefore every disable() — happens before
        // server.connect(transport), where the SDK gates dispatch on
        // isConnected(). Any frame here means the library dispatched on its own.
        await connection.client.listTools();
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(
          connection.notifications.filter((method) =>
            method.includes('list_changed'),
          ),
        ).toEqual([]);
      } finally {
        await connection.close();
      }
    });

    it('gives two concurrent connections with different request context different capability sets', async () => {
      const anonymous = await connect();
      const admin = await connect(ADMIN_HEADERS);

      try {
        const anonymousNames = await toolNames(anonymous);
        const adminNames = await toolNames(admin);

        expect(anonymousNames).not.toContain('admin_only_tool');
        expect(adminNames).toContain('admin_only_tool');

        // Neither connection's set moved because the other one exists.
        expect(await toolNames(anonymous)).toEqual(anonymousNames);
        expect(await toolNames(admin)).toEqual(adminNames);
      } finally {
        await anonymous.close();
        await admin.close();
      }
    });
  });
});
