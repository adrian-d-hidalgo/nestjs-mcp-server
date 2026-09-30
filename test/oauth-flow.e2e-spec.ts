import {
  auth,
  OAuthClientProvider,
  UnauthorizedError,
} from '@modelcontextprotocol/sdk/client/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js';
import { createHash } from 'crypto';
import {
  decodeJwt,
  decodeProtectedHeader,
  generateKeyPair,
  SignJWT,
} from 'jose';

import type { CallToolResult } from '../src';
import {
  ALICE,
  authorizeAs,
  BOB,
  Credentials,
  JsonRpcBody,
  pkce,
  PUBLIC_CLIENT_ID,
  REDIRECT_URL,
  STATE,
  UserAgent,
  useOAuthExample,
} from './support/oauth';

/**
 * The OAuth 2.1 flow against `examples/oauth` as the official MCP SDK v1
 * client drives it (`auth()` + `OAuthClientProvider`): discovery, the
 * authorization code exchange, refresh-token rotation, per-user scopes with
 * the step-up challenge, and access-token validation at the MCP endpoint.
 * Helpers and the mock AS's behavior: `test/support/oauth.ts`.
 */

/**
 * An in-memory `OAuthClientProvider` for the pre-registered public client: no
 * dynamic registration. Its "user" logs in as `user` and approves consent.
 */
class InMemoryOAuthProvider implements OAuthClientProvider {
  client?: OAuthClientInformationMixed = { client_id: PUBLIC_CLIENT_ID };
  registered = false;
  saved?: OAuthTokens;
  verifier?: string;
  authorizationUrl?: URL;
  callback?: URL;

  constructor(
    private readonly user: Credentials,
    readonly ua = new UserAgent(),
  ) {}

  get redirectUrl(): string {
    return REDIRECT_URL;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'oauth-e2e',
      redirect_uris: [REDIRECT_URL],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  get code(): string {
    const code = this.callback?.searchParams.get('code');
    if (!code) throw new Error(`No code in ${String(this.callback)}`);
    return code;
  }

  state(): string {
    return STATE;
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.client;
  }

  saveClientInformation(client: OAuthClientInformationMixed): void {
    this.registered = true;
    this.client = client;
  }

  tokens(): OAuthTokens | undefined {
    return this.saved;
  }

  saveTokens(tokens: OAuthTokens): void {
    this.saved = tokens;
  }

  /** The user agent: log in, approve consent, capture the callback URL. */
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    this.authorizationUrl = authorizationUrl;
    const page = await authorizeAs(this.ua, authorizationUrl, this.user);
    if (page.status !== 302 || !page.location) {
      throw new Error(
        `Authorization did not redirect: ${page.status} ${page.html}`,
      );
    }
    this.callback = page.location;
  }

  saveCodeVerifier(verifier: string): void {
    this.verifier = verifier;
  }

  codeVerifier(): string {
    if (!this.verifier) throw new Error('No code verifier saved');
    return this.verifier;
  }
}

describe('OAuth 2.1 end to end against the mock authorization server (e2e)', () => {
  const oauth = useOAuthExample();
  const { callTool, tokenRequest, authorizeUrl, mockAs } = oauth;

  const calls: string[] = [];
  /** Records every request the SDK client makes, as `METHOD /path`. */
  const recordingFetch: FetchLike = (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${new URL(String(url)).pathname}`);
    return fetch(url, init);
  };

  describe('discovery', () => {
    it('answers an anonymous MCP request with 401 and a resource_metadata challenge', async () => {
      const response = await callTool('list_notes', {});

      expect(response.status).toBe(401);
      const challenge = response.headers.get('www-authenticate') ?? '';
      expect(challenge).toMatch(/^Bearer /);
      expect(challenge).toContain(`resource_metadata="${oauth.prmUrl}"`);
    });

    it('serves Protected Resource Metadata that points at the mock AS', async () => {
      const metadata = (await (await fetch(oauth.prmUrl)).json()) as Record<
        string,
        unknown
      >;

      expect(metadata).toEqual(
        expect.objectContaining({
          resource: oauth.resource,
          authorization_servers: [oauth.issuer],
          scopes_supported: ['notes:read', 'notes:write'],
        }),
      );
    });

    it.each([
      [
        'RFC 8414 path-inserted',
        '/.well-known/oauth-authorization-server/oauth',
      ],
      ['root', '/.well-known/oauth-authorization-server'],
    ])(
      'serves AS metadata at the %s URL, without a registration_endpoint by default',
      async (_label, path) => {
        const response = await fetch(`${oauth.baseUrl}${path}`);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          issuer: oauth.issuer,
          authorization_endpoint: `${oauth.issuer}/authorize`,
          token_endpoint: `${oauth.issuer}/token`,
          revocation_endpoint: `${oauth.issuer}/revoke`,
          jwks_uri: `${oauth.issuer}/jwks`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          token_endpoint_auth_methods_supported: [
            'none',
            'client_secret_basic',
            'client_secret_post',
          ],
          revocation_endpoint_auth_methods_supported: [
            'none',
            'client_secret_basic',
            'client_secret_post',
          ],
          scopes_supported: ['notes:read', 'notes:write'],
          authorization_response_iss_parameter_supported: true,
        });
      },
    );

    it('refuses dynamic client registration by default', async () => {
      const response = await fetch(`${oauth.issuer}/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ redirect_uris: [REDIRECT_URL] }),
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual(
        expect.objectContaining({ error: 'access_denied' }),
      );
    });
  });

  describe('authorization code flow with the SDK client (alice, notes-inspector)', () => {
    const provider = new InMemoryOAuthProvider(ALICE);

    it('discovers PRM → AS metadata, skips registration and logs in and consents at /authorize', async () => {
      const transport = new StreamableHTTPClientTransport(oauth.mcpUrl, {
        authProvider: provider,
        fetch: recordingFetch,
      });
      const client = new Client({ name: 'oauth-e2e', version: '1.0.0' });

      await expect(client.connect(transport)).rejects.toThrow(
        UnauthorizedError,
      );
      await transport.close();

      const order = [
        'POST /mcp',
        'GET /.well-known/oauth-protected-resource/mcp',
        'GET /.well-known/oauth-authorization-server/oauth',
      ].map((call) => calls.indexOf(call));
      expect(order.every((index) => index >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(calls).not.toContain('POST /oauth/register');
      expect(provider.registered).toBe(false);

      const params = provider.authorizationUrl?.searchParams;
      expect(
        provider.authorizationUrl?.origin +
          (provider.authorizationUrl?.pathname ?? ''),
      ).toBe(`${oauth.issuer}/authorize`);
      expect(params?.get('response_type')).toBe('code');
      expect(params?.get('client_id')).toBe(PUBLIC_CLIENT_ID);
      expect(params?.get('redirect_uri')).toBe(REDIRECT_URL);
      expect(params?.get('code_challenge_method')).toBe('S256');
      expect(params?.get('code_challenge')).toBe(
        createHash('sha256')
          .update(provider.codeVerifier())
          .digest('base64url'),
      );
      expect(params?.get('resource')).toBe(oauth.resource);
      expect(params?.get('scope')).toBe('notes:read notes:write');

      // The callback after login and consent, as the client's handler sees it.
      expect(
        provider.callback?.origin + (provider.callback?.pathname ?? ''),
      ).toBe(REDIRECT_URL);
      expect(provider.callback?.searchParams.get('state')).toBe(STATE);
      expect(provider.callback?.searchParams.get('iss')).toBe(oauth.issuer);
      expect(provider.code).toEqual(expect.any(String));
    });

    it('sets an HttpOnly, SameSite=Lax session cookie at login', () => {
      expect(provider.ua.setCookies).toHaveLength(1);
      const [cookie] = provider.ua.setCookies;
      expect(cookie).toMatch(/;\s*HttpOnly/i);
      expect(cookie).toMatch(/;\s*SameSite=Lax/i);
      expect(cookie).toMatch(/;\s*Max-Age=\d+/i);
    });

    it('exchanges the code (PKCE) for an RS256 JWT for alice with both scopes', async () => {
      const transport = new StreamableHTTPClientTransport(oauth.mcpUrl, {
        authProvider: provider,
        fetch: recordingFetch,
      });
      await transport.finishAuth(provider.code);

      expect(calls).toContain('POST /oauth/token');
      const tokens = provider.tokens();
      expect(tokens?.token_type.toLowerCase()).toBe('bearer');
      expect(tokens?.refresh_token).toEqual(expect.any(String));

      const claims = decodeJwt(tokens?.access_token ?? '');
      expect(decodeProtectedHeader(tokens?.access_token ?? '').alg).toBe(
        'RS256',
      );
      expect(claims).toEqual(
        expect.objectContaining({
          iss: oauth.issuer,
          aud: oauth.resource,
          sub: 'alice',
          scope: 'notes:read notes:write',
          client_id: PUBLIC_CLIENT_ID,
        }),
      );
      expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBeLessThanOrEqual(600);
    });

    it('reuses the same authorization code only once', async () => {
      const response = await tokenRequest({
        grant_type: 'authorization_code',
        code: provider.code,
        code_verifier: provider.codeVerifier(),
        redirect_uri: REDIRECT_URL,
        client_id: PUBLIC_CLIENT_ID,
        resource: oauth.resource,
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({ error: 'invalid_grant' }),
      );
    });

    it('lists tools and calls read and write tools with the issued token', async () => {
      const transport = new StreamableHTTPClientTransport(oauth.mcpUrl, {
        authProvider: provider,
      });
      const client = new Client({ name: 'oauth-e2e', version: '1.0.0' });

      try {
        await client.connect(transport);
        const { tools } = await client.listTools();
        expect(tools.map((tool) => tool.name)).toEqual(
          expect.arrayContaining(['whoami', 'list_notes', 'add_note']),
        );

        const whoami = (await client.callTool({
          name: 'whoami',
          arguments: {},
        })) as CallToolResult;
        expect(JSON.stringify(whoami.content)).toContain(PUBLIC_CLIENT_ID);
        expect(JSON.stringify(whoami.content)).toContain('alice');

        const list = (await client.callTool({
          name: 'list_notes',
          arguments: {},
        })) as CallToolResult;
        expect(list.isError).toBeFalsy();

        const add = (await client.callTool({
          name: 'add_note',
          arguments: { text: 'written over OAuth' },
        })) as CallToolResult;
        expect(add.isError).toBeFalsy();
      } finally {
        await transport.close();
      }
    });

    it('rotates the refresh token and refuses the old one', async () => {
      const previous = provider.tokens();

      await expect(auth(provider, { serverUrl: oauth.mcpUrl })).resolves.toBe(
        'AUTHORIZED',
      );

      const current = provider.tokens();
      expect(current?.refresh_token).toEqual(expect.any(String));
      expect(current?.refresh_token).not.toBe(previous?.refresh_token);
      expect(decodeJwt(current?.access_token ?? '').sub).toBe('alice');

      const replay = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: previous?.refresh_token ?? '',
        client_id: PUBLIC_CLIENT_ID,
      });
      expect(replay.status).toBe(400);
      expect(await replay.json()).toEqual(
        expect.objectContaining({ error: 'invalid_grant' }),
      );
    });
  });

  describe('per-user scope policy (bob, notes-inspector)', () => {
    const bob = new InMemoryOAuthProvider(BOB);

    beforeAll(async () => {
      await expect(auth(bob, { serverUrl: oauth.mcpUrl })).resolves.toBe(
        'REDIRECT',
      );
      await expect(
        auth(bob, { serverUrl: oauth.mcpUrl, authorizationCode: bob.code }),
      ).resolves.toBe('AUTHORIZED');
    });

    it('requested both scopes but is granted only notes:read', () => {
      expect(bob.authorizationUrl?.searchParams.get('scope')).toBe(
        'notes:read notes:write',
      );
      expect(bob.tokens()?.scope).toBe('notes:read');
      expect(decodeJwt(bob.tokens()?.access_token ?? '')).toEqual(
        expect.objectContaining({ sub: 'bob', scope: 'notes:read' }),
      );
    });

    it('lets a notes:read token call the read tool', async () => {
      const response = await callTool(
        'list_notes',
        {},
        bob.tokens()?.access_token,
      );
      const body = (await response.json()) as JsonRpcBody;

      expect(response.status).toBe(200);
      expect(body.error).toBeUndefined();
    });

    it('answers add_note with 403 insufficient_scope from the MCP endpoint', async () => {
      const response = await callTool(
        'add_note',
        { text: 'x' },
        bob.tokens()?.access_token,
      );

      expect(response.status).toBe(403);
      const challenge = response.headers.get('www-authenticate') ?? '';
      expect(challenge).toContain('error="insufficient_scope"');
      expect(challenge).toContain('scope="notes:write"');
      expect(challenge).toContain(`resource_metadata="${oauth.prmUrl}"`);
    });

    /**
     * SDK v1 reacts to the 403 by calling `auth()` with the challenged scope.
     * Holding a refresh token, `auth()` refreshes instead of re-authorizing,
     * the refreshed grant still lacks `notes:write`, and the transport gives
     * up on the identical second challenge. Deterministic, so asserted.
     */
    it('makes the SDK client attempt step-up and then fail with 403', async () => {
      const transport = new StreamableHTTPClientTransport(oauth.mcpUrl, {
        authProvider: bob,
      });
      const client = new Client({ name: 'oauth-e2e', version: '1.0.0' });

      try {
        await client.connect(transport);
        await expect(
          client.callTool({ name: 'add_note', arguments: { text: 'x' } }),
        ).rejects.toThrow(/403/);
      } finally {
        await transport.close();
      }
    });

    it('redirects with invalid_scope when bob asks only for notes:write', async () => {
      const { challenge } = pkce();
      const page = await authorizeAs(
        new UserAgent(),
        authorizeUrl(challenge, { scope: 'notes:write' }),
        BOB,
      );

      expect(page.status).toBe(302);
      expect(page.location?.searchParams.get('error')).toBe('invalid_scope');
      expect(page.location?.searchParams.get('error_description')).toContain(
        'notes:read',
      );
      expect(page.location?.searchParams.get('state')).toBe(STATE);
      expect(page.location?.searchParams.get('code')).toBeNull();
    });
  });

  describe('token validation', () => {
    const expectInvalidToken = async (token: string): Promise<void> => {
      const response = await callTool('list_notes', {}, token);

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain(
        'error="invalid_token"',
      );
    };

    it('rejects a token the same AS minted for another audience', async () => {
      await expectInvalidToken(
        await mockAs().issueAccessToken({
          audience: 'https://other.example.com/mcp',
          clientId: 'someone',
          subject: 'alice',
          scope: 'notes:read',
        }),
      );
    });

    it('rejects an expired token', async () => {
      await expectInvalidToken(
        await mockAs().issueAccessToken({
          audience: oauth.resource,
          clientId: 'someone',
          subject: 'alice',
          scope: 'notes:read',
          ttlSeconds: -60,
        }),
      );
    });

    it('rejects a token signed by a key the AS does not publish', async () => {
      const { privateKey } = await generateKeyPair('RS256');
      const forged = await new SignJWT({ scope: 'notes:read notes:write' })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer(oauth.issuer)
        .setAudience(oauth.resource)
        .setSubject('mallory')
        .setExpirationTime('5m')
        .sign(privateKey);

      await expectInvalidToken(forged);
    });

    it('rejects a garbage token', async () => {
      await expectInvalidToken('not-a-jwt');
    });
  });
});
