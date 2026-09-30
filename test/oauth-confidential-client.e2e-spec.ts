import type { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { randomBytes } from 'crypto';
import { decodeJwt } from 'jose';

import {
  CONFIDENTIAL_CLIENT_ID,
  CONFIDENTIAL_CLIENT_SECRET,
} from '../examples/oauth/demo-clients';
import {
  ALICE,
  authorizeAs,
  basic,
  expectInvalidClient,
  formPost,
  JsonRpcBody,
  pageKind,
  pkce,
  STATE,
  UserAgent,
  useOAuthExample,
} from './support/oauth';

/**
 * The pre-registered confidential client (`examples/oauth/demo-clients.ts`):
 * it must authenticate at the token and revocation endpoints, may use any
 * loopback redirect URI, and the authorization server grants it
 * `notes:read` at most — even to alice, who may also write.
 */
describe('OAuth 2.1 confidential client (e2e)', () => {
  const oauth = useOAuthExample();
  const { callTool, tokenRequest, authorizeUrl } = oauth;

  describe('confidential client (alice, notes-confidential)', () => {
    /** A loopback callback on a port nobody registered (RFC 8252 §7.3). */
    const LOOPBACK_REDIRECT = 'http://127.0.0.1:61234/oauth/callback';
    const { verifier, challenge } = pkce();
    /** One browser, logged in once as alice: later flows only consent. */
    const ua = new UserAgent();

    const confidentialUrl = (overrides: Record<string, string> = {}): string =>
      authorizeUrl(challenge, {
        client_id: CONFIDENTIAL_CLIENT_ID,
        redirect_uri: LOOPBACK_REDIRECT,
        ...overrides,
      });

    /** Runs /authorize (login + consent) and returns where it redirects. */
    const callbackFor = async (
      overrides: Record<string, string> = {},
    ): Promise<URL> => {
      const page = await authorizeAs(ua, confidentialUrl(overrides), ALICE);
      expect(page.status).toBe(302);
      if (!page.location) throw new Error('No redirect');
      return page.location;
    };

    const codeFor = async (
      overrides: Record<string, string> = {},
    ): Promise<string> => {
      const code = (await callbackFor(overrides)).searchParams.get('code');
      if (!code) throw new Error('No authorization code');
      return code;
    };

    const exchange = (
      code: string,
      extra: Record<string, string> = {},
      authorization?: string,
      redirectUri = LOOPBACK_REDIRECT,
    ): Promise<Response> =>
      tokenRequest(
        {
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          resource: oauth.resource,
          ...extra,
        },
        authorization,
      );

    const secret = basic(CONFIDENTIAL_CLIENT_ID, CONFIDENTIAL_CLIENT_SECRET);

    it('names the client on the login page', async () => {
      const page = await new UserAgent().open(confidentialUrl());

      expect(pageKind(page)).toBe('login');
      expect(page.html).toContain('Notes Confidential');
    });

    it('grants alice only notes:read although she asked for both', async () => {
      const code = await codeFor({ scope: 'notes:read notes:write' });
      const response = await exchange(code, {}, secret);
      const tokens = (await response.json()) as OAuthTokens;

      expect(response.status).toBe(200);
      expect(tokens.scope).toBe('notes:read');
      expect(decodeJwt(tokens.access_token)).toEqual(
        expect.objectContaining({
          sub: 'alice',
          scope: 'notes:read',
          client_id: CONFIDENTIAL_CLIENT_ID,
          aud: oauth.resource,
        }),
      );
    });

    it('authenticates with client_secret_post', async () => {
      const response = await exchange(await codeFor(), {
        client_id: CONFIDENTIAL_CLIENT_ID,
        client_secret: CONFIDENTIAL_CLIENT_SECRET,
      });

      expect(response.status).toBe(200);
      expect(((await response.json()) as OAuthTokens).scope).toBe('notes:read');
    });

    it.each([
      [
        'a wrong secret (basic)',
        {},
        basic(CONFIDENTIAL_CLIENT_ID, 'not-the-secret'),
      ],
      [
        'a wrong secret (post)',
        { client_id: CONFIDENTIAL_CLIENT_ID, client_secret: 'not-the-secret' },
        undefined,
      ],
      ['a missing secret', { client_id: CONFIDENTIAL_CLIENT_ID }, undefined],
    ])(
      'answers %s with 401 invalid_client',
      async (_label, extra, authorization) => {
        await expectInvalidClient(
          await exchange(await codeFor(), extra, authorization),
        );
      },
    );

    it('still requires PKCE after authenticating', async () => {
      const response = await exchange(
        await codeFor(),
        { code_verifier: randomBytes(32).toString('base64url') },
        secret,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(
        expect.objectContaining({ error: 'invalid_grant' }),
      );
    });

    it('accepts any loopback redirect URI, on localhost or 127.0.0.1', async () => {
      const redirectUri = 'http://localhost:6274/oauth/callback/debug';
      const code = await codeFor({ redirect_uri: redirectUri });

      const response = await exchange(code, {}, secret, redirectUri);
      expect(response.status).toBe(200);
    });

    it('shows an error page, without redirecting, for a non-loopback redirect_uri', async () => {
      const page = await new UserAgent().open(
        confidentialUrl({ redirect_uri: 'http://evil.example.com/callback' }),
      );

      expect(page.status).toBe(400);
      expect(page.location).toBeNull();
      expect(pageKind(page)).toBe('error');
    });

    it('redirects with invalid_scope, before any login, when only notes:write is requested', async () => {
      const page = await new UserAgent().open(
        confidentialUrl({ scope: 'notes:write' }),
      );

      expect(page.status).toBe(302);
      expect(page.location?.searchParams.get('error')).toBe('invalid_scope');
      expect(page.location?.searchParams.get('error_description')).toContain(
        'notes:read',
      );
      expect(page.location?.searchParams.get('state')).toBe(STATE);
      expect(page.location?.searchParams.get('code')).toBeNull();
    });

    it('grants only its allowed scopes when no scope is requested', async () => {
      const response = await exchange(await codeFor({ scope: '' }), {}, secret);

      expect(((await response.json()) as OAuthTokens).scope).toBe('notes:read');
    });

    it('ignores offline_access: the token scope is exactly notes:read', async () => {
      const code = await codeFor({ scope: 'notes:read offline_access' });
      const response = await exchange(code, {}, secret);
      const tokens = (await response.json()) as OAuthTokens;

      expect(tokens.scope).toBe('notes:read');
      expect(decodeJwt(tokens.access_token).scope).toBe('notes:read');
    });

    describe('with an issued token', () => {
      let tokens: OAuthTokens;

      beforeAll(async () => {
        const response = await exchange(await codeFor(), {}, secret);
        tokens = (await response.json()) as OAuthTokens;
      });

      it('calls list_notes', async () => {
        const response = await callTool('list_notes', {}, tokens.access_token);
        const body = (await response.json()) as JsonRpcBody;

        expect(response.status).toBe(200);
        expect(body.error).toBeUndefined();
      });

      it('answers add_note with 403 insufficient_scope', async () => {
        const response = await callTool(
          'add_note',
          { text: 'x' },
          tokens.access_token,
        );

        expect(response.status).toBe(403);
        expect(response.headers.get('www-authenticate')).toContain(
          'error="insufficient_scope"',
        );
      });

      it('refuses a refresh without the secret with 401 invalid_client', async () => {
        await expectInvalidClient(
          await tokenRequest({
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token ?? '',
            client_id: CONFIDENTIAL_CLIENT_ID,
          }),
        );
      });

      it('refuses a revocation without the secret with 401 invalid_client', async () => {
        await expectInvalidClient(
          await formPost(`${oauth.issuer}/revoke`, {
            token: tokens.refresh_token ?? '',
            client_id: CONFIDENTIAL_CLIENT_ID,
          }),
        );
      });

      it('refreshes with the secret', async () => {
        const response = await tokenRequest(
          {
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token ?? '',
          },
          secret,
        );

        expect(response.status).toBe(200);
        const refreshed = (await response.json()) as OAuthTokens;
        expect(refreshed.scope).toBe('notes:read');
        tokens = refreshed;
      });

      it('revokes its refresh token with the secret', async () => {
        const revoke = await formPost(
          `${oauth.issuer}/revoke`,
          { token: tokens.refresh_token ?? '' },
          secret,
        );
        expect(revoke.status).toBe(200);

        const refresh = await tokenRequest(
          {
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token ?? '',
          },
          secret,
        );
        expect(refresh.status).toBe(400);
        expect(await refresh.json()).toEqual(
          expect.objectContaining({ error: 'invalid_grant' }),
        );
      });
    });
  });
});
