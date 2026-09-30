import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomBytes } from 'crypto';
import { createServer, RequestListener, Server } from 'http';
import type { AddressInfo } from 'net';

import { OAuthExampleModule } from '../../examples/oauth/app.module';
import { MockAuthorizationServer } from '../../examples/oauth/mock-authorization-server';
import { resolveOAuthConfig } from '../../examples/oauth/oauth.config';
import { e2eLogger } from './logger';

/**
 * Shared helpers of the OAuth e2e specs (`test/oauth-*.e2e-spec.ts`): they run
 * a real OAuth 2.1 authorization-code flow against `examples/oauth`, with no
 * Docker and no external account — the example mounts an in-process mock
 * authorization server next to the MCP endpoint.
 *
 * The mock behaves like a hosted provider: it shows a login page, then a
 * consent page, and grants the intersection of the requested scopes, the
 * client's allowed scopes and the user's allowed scopes. The only thing the
 * tests fake is the human: {@link UserAgent} plays the browser — it keeps a
 * cookie jar by hand, follows no redirect, and submits the HTML forms.
 */

export const REDIRECT_URL = 'http://127.0.0.1:53682/callback';
export const STATE = 'e2e-state';

/** The pre-registered public client (`examples/oauth/demo-clients.ts`). */
export const PUBLIC_CLIENT_ID = 'notes-inspector';

export interface Credentials {
  username: string;
  password: string;
}

/** Demo users (`examples/oauth/demo-users.ts`). */
export const ALICE: Credentials = {
  username: 'alice',
  password: 'alice-password',
};
export const BOB: Credentials = { username: 'bob', password: 'bob-password' };

const ENVELOPE = {
  'io.modelcontextprotocol/clientInfo': { name: 'oauth-e2e', version: '1.0' },
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
};

/** One HTTP response, as the user agent saw it. */
export interface Page {
  url: URL;
  status: number;
  html: string;
  location: URL | null;
}

/** `login`, `consent` or `error`: the page's `data-page` marker. */
export const pageKind = (page: Page): string | undefined =>
  /data-page="([a-z]+)"/.exec(page.html)?.[1];

/**
 * A minimal browser: a hand-kept cookie jar, no redirect following, and form
 * submission that reads the form's `action` and hidden inputs off the HTML.
 */
export class UserAgent {
  readonly cookies = new Map<string, string>();
  /** Raw `Set-Cookie` headers, to assert the cookie attributes. */
  readonly setCookies: string[] = [];

  async fetch(url: URL | string, init: RequestInit = {}): Promise<Page> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set(
        'cookie',
        [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '),
      );
    }
    const response = await fetch(url, { ...init, headers, redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) {
      this.setCookies.push(cookie);
      const [pair] = cookie.split(';');
      const eq = pair.indexOf('=');
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    const location = response.headers.get('location');
    return {
      url: new URL(url),
      status: response.status,
      html: await response.text(),
      location: location ? new URL(location, url) : null,
    };
  }

  open(url: URL | string): Promise<Page> {
    return this.fetch(url);
  }

  /** Submits the page's form with its hidden inputs plus `fields`. */
  submit(page: Page, fields: Record<string, string>): Promise<Page> {
    const form = /<form[^>]*\baction="([^"]*)"/.exec(page.html);
    if (!form) throw new Error(`No form on the page:\n${page.html}`);
    const hidden = Object.fromEntries(
      [
        ...page.html.matchAll(
          /<input type="hidden" name="([^"]+)" value="([^"]*)"/g,
        ),
      ].map((match) => [match[1], match[2]]),
    );
    return this.fetch(new URL(form[1], page.url), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...hidden, ...fields }),
    });
  }
}

/**
 * Walks an authorization request through login (when the AS asks for it) and
 * consent, and returns the last page: normally the redirect to the client.
 */
export const authorizeAs = async (
  ua: UserAgent,
  authorizationUrl: URL | string,
  user?: Credentials,
  decision: 'approve' | 'deny' = 'approve',
): Promise<Page> => {
  let page = await ua.open(authorizationUrl);
  if (pageKind(page) === 'login') {
    if (!user) throw new Error('The AS asked for a login');
    page = await ua.submit(page, { ...user });
  }
  if (pageKind(page) === 'consent') {
    page = await ua.submit(page, { decision });
  }
  return page;
};

export const pkce = (): { verifier: string; challenge: string } => {
  const verifier = randomBytes(32).toString('base64url');
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
};

export interface JsonRpcBody {
  result?: {
    tools?: { name: string }[];
    content?: { text: string }[];
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

export interface BootedExample {
  server: Server;
  app: INestApplication;
  resource: string;
  issuer: string;
}

/**
 * Boots the example on a port the OS picks. The resource URL and issuer are
 * part of the module's configuration, so the port must be known before the
 * module is built: bind first, then hand the Express app to the server.
 * `env` is what `resolveOAuthConfig` reads instead of `process.env`.
 */
export const bootExample = async (
  env: NodeJS.ProcessEnv = {},
): Promise<BootedExample> => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;

  const config = resolveOAuthConfig(baseUrl, env);
  const fixture = await Test.createTestingModule({
    imports: [OAuthExampleModule.forConfig(config)],
  }).compile();
  const app = fixture.createNestApplication({ logger: e2eLogger() });
  await app.init();
  server.on('request', app.getHttpAdapter().getInstance() as RequestListener);

  return { server, app, resource: config.resource, issuer: config.issuer };
};

export const shutdown = async ({
  app,
  server,
}: BootedExample): Promise<void> => {
  await app.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
};

/** A raw `tools/call` over the 2026-07-28 stateless transport. */
export const postToolCall = (
  mcpUrl: URL | string,
  name: string,
  args: Record<string, unknown>,
  token?: string,
): Promise<Response> =>
  fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'tools/call',
      'Mcp-Name': name,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args, _meta: ENVELOPE },
    }),
  });

/** A form-encoded POST to an AS endpoint, optionally with Basic auth. */
export const formPost = (
  url: string,
  params: Record<string, string>,
  authorization?: string,
): Promise<Response> =>
  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(authorization ? { authorization } : {}),
    },
    body: new URLSearchParams(params),
  });

export const basic = (id: string, secret: string): string =>
  `Basic ${Buffer.from(
    `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`,
  ).toString('base64')}`;

export const expectInvalidClient = async (
  response: Response,
): Promise<void> => {
  expect(response.status).toBe(401);
  expect(response.headers.get('www-authenticate')).toMatch(
    /^Basic realm="[^"]+"/,
  );
  expect(await response.json()).toEqual(
    expect.objectContaining({ error: 'invalid_client' }),
  );
};

/** The booted example, with the URLs and requests most specs need. */
export interface OAuthExample {
  app: INestApplication;
  baseUrl: string;
  resource: string;
  issuer: string;
  /** The Protected Resource Metadata URL. */
  prmUrl: string;
  mcpUrl: URL;
  /** A raw `tools/call` to the MCP endpoint. */
  callTool: (
    name: string,
    args: Record<string, unknown>,
    token?: string,
  ) => Promise<Response>;
  /** A form POST to the token endpoint. */
  tokenRequest: (
    params: Record<string, string>,
    authorization?: string,
  ) => Promise<Response>;
  /** An authorization URL: the public client, `notes:read`, {@link STATE}. */
  authorizeUrl: (
    challenge: string,
    overrides?: Record<string, string>,
  ) => string;
  mockAs: () => MockAuthorizationServer;
}

/**
 * Boots the example (default configuration) in `beforeAll` and shuts it down
 * in `afterAll`. The returned object is filled in by `beforeAll`: read its
 * fields inside hooks and tests, not at `describe` time.
 */
export const useOAuthExample = (): OAuthExample => {
  let booted: BootedExample;

  const example: OAuthExample = {
    app: undefined as unknown as INestApplication,
    baseUrl: '',
    resource: '',
    issuer: '',
    prmUrl: '',
    mcpUrl: undefined as unknown as URL,
    callTool: (name, args, token) =>
      postToolCall(example.mcpUrl, name, args, token),
    tokenRequest: (params, authorization) =>
      formPost(`${example.issuer}/token`, params, authorization),
    authorizeUrl: (challenge, overrides = {}) =>
      `${example.issuer}/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: PUBLIC_CLIENT_ID,
        redirect_uri: REDIRECT_URL,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        resource: example.resource,
        scope: 'notes:read',
        state: STATE,
        ...overrides,
      }).toString()}`,
    mockAs: () => example.app.get(MockAuthorizationServer),
  };

  beforeAll(async () => {
    booted = await bootExample();
    example.app = booted.app;
    example.resource = booted.resource;
    example.issuer = booted.issuer;
    example.mcpUrl = new URL(booted.resource);
    example.baseUrl = example.mcpUrl.origin;
    example.prmUrl = `${example.baseUrl}/.well-known/oauth-protected-resource/mcp`;
  });

  afterAll(() => shutdown(booted));

  return example;
};
