import type { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { randomBytes } from 'crypto';
import { decodeJwt } from 'jose';

import {
  CONFIDENTIAL_CLIENT_ID,
  CONFIDENTIAL_CLIENT_SECRET,
} from '../examples/oauth/demo-clients';
import { resolveOAuthConfig } from '../examples/oauth/oauth.config';
import {
  ALICE,
  authorizeAs,
  basic,
  BOB,
  BootedExample,
  bootExample,
  Credentials,
  expectInvalidClient,
  formPost,
  pageKind,
  pkce,
  PUBLIC_CLIENT_ID,
  REDIRECT_URL,
  shutdown,
  STATE,
  UserAgent,
  useOAuthExample,
} from './support/oauth';

/**
 * The mock authorization server's own behavior (`examples/oauth`), driven
 * over HTTP by a scripted browser: request validation, login, the SSO
 * session, consent, code redemption, revocation (RFC 7009) and — opt-in —
 * dynamic client registration (RFC 7591).
 * Helpers: `test/support/oauth.ts`.
 */

describe('OAuth 2.1 mock authorization server: login, consent and tokens (e2e)', () => {
  const oauth = useOAuthExample();
  const { tokenRequest, authorizeUrl } = oauth;

  describe('login and consent', () => {
    const { verifier, challenge } = pkce();

    /** Runs the whole flow as `user` and returns the authorization code. */
    const codeFor = async (
      ua: UserAgent,
      user: Credentials,
      overrides: Record<string, string> = {},
    ): Promise<string> => {
      const page = await authorizeAs(
        ua,
        authorizeUrl(challenge, overrides),
        user,
      );
      const code = page.location?.searchParams.get('code');
      if (!code) throw new Error(`No code: ${page.status} ${page.html}`);
      return code;
    };

    const exchange = (
      code: string,
      extra: Record<string, string> = {},
    ): Promise<Response> =>
      tokenRequest({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: REDIRECT_URL,
        client_id: PUBLIC_CLIENT_ID,
        resource: oauth.resource,
        ...extra,
      });

    it.each([
      ['an unknown client_id', { client_id: 'no-such-client' }],
      [
        'a non-loopback redirect_uri',
        { redirect_uri: 'http://evil.example.com/callback' },
      ],
      [
        'an https redirect_uri on localhost',
        { redirect_uri: 'https://localhost:53682/callback' },
      ],
    ])(
      'shows an error page, without redirecting, for %s',
      async (_label, overrides) => {
        const page = await new UserAgent().open(
          authorizeUrl(challenge, overrides),
        );

        expect(page.status).toBe(400);
        expect(page.location).toBeNull();
        expect(pageKind(page)).toBe('error');
        expect(page.html).toContain('invalid_request');
      },
    );

    it.each([
      [
        'a plain code_challenge_method',
        { code_challenge_method: 'plain' },
        'invalid_request',
      ],
      [
        'a foreign resource',
        { resource: 'https://other.example.com/mcp' },
        'invalid_target',
      ],
      ['an unknown scope', { scope: 'notes:admin' }, 'invalid_scope'],
      [
        'response_type=token',
        { response_type: 'token' },
        'unsupported_response_type',
      ],
    ])(
      'redirects back with an error, before any login, for %s',
      async (_label, overrides, error) => {
        const page = await new UserAgent().open(
          authorizeUrl(challenge, overrides),
        );

        expect(page.status).toBe(302);
        expect(page.location?.searchParams.get('error')).toBe(error);
        expect(page.location?.searchParams.get('state')).toBe(STATE);
        expect(page.location?.searchParams.get('iss')).toBe(oauth.issuer);
      },
    );

    it('shows a login page naming the client, with a form posting to /oauth/login', async () => {
      const page = await new UserAgent().open(authorizeUrl(challenge));

      expect(page.status).toBe(200);
      expect(pageKind(page)).toBe('login');
      expect(page.html).toContain('Notes Inspector');
      expect(page.html).toMatch(/<form method="post" action="login"/);
      expect(page.html).toContain('name="password"');
    });

    it('answers a wrong password with the login page again, and no redirect or cookie', async () => {
      const ua = new UserAgent();
      const login = await ua.open(authorizeUrl(challenge));
      const retry = await ua.submit(login, {
        username: 'alice',
        password: 'wrong',
      });

      expect(retry.status).toBe(401);
      expect(retry.location).toBeNull();
      expect(pageKind(retry)).toBe('login');
      expect(retry.html).toContain('Invalid username or password');
      expect(ua.cookies.size).toBe(0);

      // The same pending request still accepts the right password.
      const consent = await ua.submit(retry, { ...ALICE });
      expect(pageKind(consent)).toBe('consent');
    });

    it('answers an unknown user like a wrong password', async () => {
      const ua = new UserAgent();
      const login = await ua.open(authorizeUrl(challenge));
      const retry = await ua.submit(login, {
        username: 'mallory',
        password: 'alice-password',
      });

      expect(retry.status).toBe(401);
      expect(pageKind(retry)).toBe('login');
    });

    it('shows a consent page with the client, the user and the scopes to grant', async () => {
      const ua = new UserAgent();
      const login = await ua.open(
        authorizeUrl(challenge, { scope: 'notes:read notes:write' }),
      );
      const consent = await ua.submit(login, { ...ALICE });

      expect(consent.status).toBe(200);
      expect(pageKind(consent)).toBe('consent');
      expect(consent.html).toContain('Notes Inspector');
      expect(consent.html).toContain('alice');
      expect(consent.html).toContain('notes:read');
      expect(consent.html).toContain('notes:write');
      expect(consent.html).toMatch(/<form method="post" action="consent"/);
      expect(consent.html).toContain('value="approve"');
      expect(consent.html).toContain('value="deny"');
    });

    it('lists only the scopes the user may grant on the consent page', async () => {
      const ua = new UserAgent();
      const login = await ua.open(
        authorizeUrl(challenge, { scope: 'notes:read notes:write' }),
      );
      const consent = await ua.submit(login, { ...BOB });

      expect(pageKind(consent)).toBe('consent');
      expect(consent.html).toContain('notes:read');
      expect(consent.html).not.toContain('notes:write');
    });

    it('redirects with access_denied when the user denies consent', async () => {
      const page = await authorizeAs(
        new UserAgent(),
        authorizeUrl(challenge),
        ALICE,
        'deny',
      );

      expect(page.status).toBe(302);
      expect(page.location?.origin + (page.location?.pathname ?? '')).toBe(
        REDIRECT_URL,
      );
      expect(page.location?.searchParams.get('error')).toBe('access_denied');
      expect(page.location?.searchParams.get('state')).toBe(STATE);
      expect(page.location?.searchParams.get('iss')).toBe(oauth.issuer);
      expect(page.location?.searchParams.get('code')).toBeNull();
    });

    it('accepts a consent decision only once', async () => {
      const ua = new UserAgent();
      const login = await ua.open(authorizeUrl(challenge));
      const consent = await ua.submit(login, { ...ALICE });
      const approved = await ua.submit(consent, { decision: 'approve' });
      expect(approved.status).toBe(302);

      const replay = await ua.submit(consent, { decision: 'approve' });
      expect(replay.status).toBe(400);
      expect(replay.location).toBeNull();
      expect(pageKind(replay)).toBe('error');
    });

    it('refuses a consent decision from a browser without the session', async () => {
      const ua = new UserAgent();
      const login = await ua.open(authorizeUrl(challenge));
      const consent = await ua.submit(login, { ...ALICE });

      const attacker = await new UserAgent().submit(consent, {
        decision: 'approve',
      });
      expect(attacker.status).toBe(400);
      expect(attacker.location).toBeNull();
      expect(pageKind(attacker)).toBe('error');
    });

    it('skips the login on a second authorization in the same browser, but still asks for consent', async () => {
      const ua = new UserAgent();
      await codeFor(ua, ALICE);
      expect(ua.cookies.size).toBe(1);

      const second = await ua.open(authorizeUrl(challenge));
      expect(second.status).toBe(200);
      expect(pageKind(second)).toBe('consent');
      expect(second.html).toContain('alice');

      const approved = await ua.submit(second, { decision: 'approve' });
      const code = approved.location?.searchParams.get('code') ?? '';
      const response = await exchange(code);
      expect(response.status).toBe(200);
      expect(
        decodeJwt(((await response.json()) as OAuthTokens).access_token).sub,
      ).toBe('alice');
    });

    it('refuses a code exchanged with the wrong PKCE verifier', async () => {
      const response = await exchange(await codeFor(new UserAgent(), ALICE), {
        code_verifier: randomBytes(32).toString('base64url'),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({ error: 'invalid_grant' }),
      );
    });

    it('refuses a code redeemed with another redirect_uri', async () => {
      const response = await exchange(await codeFor(new UserAgent(), ALICE), {
        redirect_uri: 'http://127.0.0.1:1/other',
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({ error: 'invalid_grant' }),
      );
    });

    it('ignores offline_access and leaves it out of the token scope', async () => {
      const response = await exchange(
        await codeFor(new UserAgent(), ALICE, {
          scope: 'offline_access notes:read',
        }),
      );
      const tokens = (await response.json()) as OAuthTokens;

      expect(response.status).toBe(200);
      expect(tokens.scope).toBe('notes:read');
      expect(decodeJwt(tokens.access_token).scope).toBe('notes:read');
    });

    it('grants client ∩ user scopes when no scope is requested', async () => {
      const response = await exchange(
        await codeFor(new UserAgent(), BOB, { scope: '' }),
      );

      expect(((await response.json()) as OAuthTokens).scope).toBe('notes:read');
    });

    it('answers an unknown client_id at the token endpoint with 401 invalid_client', async () => {
      await expectInvalidClient(
        await tokenRequest({
          grant_type: 'refresh_token',
          refresh_token: 'whatever',
          client_id: 'no-such-client',
        }),
      );
    });

    it('publishes the signing key as a JWKS', async () => {
      const jwks = (await (await fetch(`${oauth.issuer}/jwks`)).json()) as {
        keys: { kty: string; alg: string; kid: string; d?: string }[];
      };

      expect(jwks.keys).toHaveLength(1);
      expect(jwks.keys[0]).toEqual(
        expect.objectContaining({ kty: 'RSA', alg: 'RS256' }),
      );
      expect(jwks.keys[0].d).toBeUndefined();
    });
  });

  describe('token revocation (RFC 7009)', () => {
    const { verifier, challenge } = pkce();
    const ua = new UserAgent();

    const issueTokens = async (): Promise<OAuthTokens> => {
      const page = await authorizeAs(ua, authorizeUrl(challenge), ALICE);
      const response = await tokenRequest({
        grant_type: 'authorization_code',
        code: page.location?.searchParams.get('code') ?? '',
        code_verifier: verifier,
        redirect_uri: REDIRECT_URL,
        client_id: PUBLIC_CLIENT_ID,
        resource: oauth.resource,
      });
      return (await response.json()) as OAuthTokens;
    };

    it('revokes a refresh token: refreshing with it then fails with invalid_grant', async () => {
      const tokens = await issueTokens();

      const revoke = await formPost(`${oauth.issuer}/revoke`, {
        token: tokens.refresh_token ?? '',
        token_type_hint: 'refresh_token',
        client_id: PUBLIC_CLIENT_ID,
      });
      expect(revoke.status).toBe(200);

      const refresh = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token ?? '',
        client_id: PUBLIC_CLIENT_ID,
      });
      expect(refresh.status).toBe(400);
      expect(await refresh.json()).toEqual(
        expect.objectContaining({ error: 'invalid_grant' }),
      );
    });

    it('answers 200 for an unknown token', async () => {
      const revoke = await formPost(`${oauth.issuer}/revoke`, {
        token: 'never-issued',
        client_id: PUBLIC_CLIENT_ID,
      });

      expect(revoke.status).toBe(200);
    });

    it('answers a request without a token with 400 invalid_request', async () => {
      const revoke = await formPost(`${oauth.issuer}/revoke`, {
        client_id: PUBLIC_CLIENT_ID,
      });

      expect(revoke.status).toBe(400);
      expect(await revoke.json()).toEqual(
        expect.objectContaining({ error: 'invalid_request' }),
      );
    });

    it('does not revoke a refresh token issued to another client', async () => {
      const tokens = await issueTokens();

      const revoke = await formPost(
        `${oauth.issuer}/revoke`,
        { token: tokens.refresh_token ?? '' },
        basic(CONFIDENTIAL_CLIENT_ID, CONFIDENTIAL_CLIENT_SECRET),
      );
      expect(revoke.status).toBe(200);

      const refresh = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token ?? '',
        client_id: PUBLIC_CLIENT_ID,
      });
      expect(refresh.status).toBe(200);
    });
  });
});

/** `OAUTH_DYNAMIC_REGISTRATION=true`: RFC 7591 registration, opt-in. */
describe('OAuth example: dynamic client registration enabled (e2e)', () => {
  let example: BootedExample;
  let clientId: string;
  const { verifier, challenge } = pkce();

  const register = (metadata: Record<string, unknown>): Promise<Response> =>
    fetch(`${example.issuer}/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(metadata),
    });

  const authorizeUrl = (overrides: Record<string, string> = {}): string =>
    `${example.issuer}/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URL,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: example.resource,
      scope: 'notes:read notes:write',
      state: STATE,
      ...overrides,
    }).toString()}`;

  beforeAll(async () => {
    example = await bootExample({ OAUTH_DYNAMIC_REGISTRATION: 'true' });
    const response = await register({
      client_name: 'Registered E2E',
      redirect_uris: [REDIRECT_URL],
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      client_id?: unknown;
      token_endpoint_auth_method?: unknown;
    };
    expect(typeof body.client_id).toBe('string');
    expect(body.token_endpoint_auth_method).toBe('none');
    clientId = String(body.client_id);
  });

  afterAll(() => shutdown(example));

  it('advertises the registration_endpoint', async () => {
    const metadata = (await (
      await fetch(
        `${new URL(example.issuer).origin}/.well-known/oauth-authorization-server/oauth`,
      )
    ).json()) as Record<string, unknown>;

    expect(metadata.registration_endpoint).toBe(`${example.issuer}/register`);
  });

  it('refuses to register a client without redirect_uris', async () => {
    const response = await register({ client_name: 'no-redirects' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({ error: 'invalid_client_metadata' }),
    );
  });

  it('shows an error page for a redirect_uri the client did not register', async () => {
    const page = await new UserAgent().open(
      authorizeUrl({ redirect_uri: 'http://127.0.0.1:53682/other' }),
    );

    expect(page.status).toBe(400);
    expect(page.location).toBeNull();
    expect(pageKind(page)).toBe('error');
  });

  it('names the registered client on the login page and grants alice both scopes', async () => {
    const ua = new UserAgent();
    const login = await ua.open(authorizeUrl());
    expect(login.html).toContain('Registered E2E');

    const page = await authorizeAs(ua, authorizeUrl(), ALICE);
    const response = await formPost(`${example.issuer}/token`, {
      grant_type: 'authorization_code',
      code: page.location?.searchParams.get('code') ?? '',
      code_verifier: verifier,
      redirect_uri: REDIRECT_URL,
      client_id: clientId,
      resource: example.resource,
    });

    expect(response.status).toBe(200);
    expect(((await response.json()) as OAuthTokens).scope).toBe(
      'notes:read notes:write',
    );
  });

  it('escapes the client name it renders', async () => {
    const response = await register({
      client_name: '<script>alert(1)</script>',
      redirect_uris: [REDIRECT_URL],
    });
    const { client_id: evilId } = (await response.json()) as {
      client_id: string;
    };

    const page = await new UserAgent().open(
      authorizeUrl({ client_id: evilId }),
    );
    expect(page.html).not.toContain('<script>alert(1)</script>');
    expect(page.html).toContain('&lt;script&gt;');
  });
});

describe('OAuth example: where the mock authorization server may be mounted', () => {
  it('mounts it with zero configuration on a loopback base URL', () => {
    expect(
      resolveOAuthConfig('http://localhost:3200', {}).mockAuthorizationServer,
    ).toBe(true);
    expect(
      resolveOAuthConfig('http://127.0.0.1:3200', {}).mockAuthorizationServer,
    ).toBe(true);
  });

  it('refuses to mount it when NODE_ENV is production', () => {
    expect(() =>
      resolveOAuthConfig('http://localhost:3200', { NODE_ENV: 'production' }),
    ).toThrow(/mock authorization server.*OAUTH_ISSUER/);
  });

  it('refuses to mount it on a non-loopback BASE_URL or MCP_RESOURCE', () => {
    expect(() => resolveOAuthConfig('https://mcp.example.com', {})).toThrow(
      /mock authorization server.*OAUTH_ISSUER/,
    );
    expect(() =>
      resolveOAuthConfig('http://localhost:3200', {
        MCP_RESOURCE: 'https://mcp.example.com/mcp',
      }),
    ).toThrow(/mock authorization server.*OAUTH_ISSUER/);
  });

  it('trusts a real issuer anywhere, without mounting the mock', () => {
    const config = resolveOAuthConfig('https://mcp.example.com', {
      NODE_ENV: 'production',
      OAUTH_ISSUER: 'https://auth.example.com',
    });

    expect(config.mockAuthorizationServer).toBe(false);
    expect(config.issuer).toBe('https://auth.example.com');
  });
});
