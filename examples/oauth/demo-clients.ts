/**
 * The clients pre-registered with the mock authorization server — the way you
 * would register an application by hand in the Auth0, Okta or Keycloak
 * console.
 *
 * DEMO ONLY. These values are hard-coded on purpose and the secret is NOT a
 * secret: it is published in this repository so anyone can paste it into the
 * MCP Inspector's OAuth settings and watch the authorization server enforce
 * client authentication and a per-client scope policy. A real authorization
 * server issues client secrets at registration and never ships them in source
 * code.
 */

export interface DemoClient {
  clientId: string;
  /** Shown on the login and consent pages. */
  clientName: string;
  /**
   * Confidential clients only: authenticates at the token and revocation
   * endpoints (`client_secret_basic` or `client_secret_post`). Public clients
   * (`token_endpoint_auth_method: none`) have none.
   */
  clientSecret?: string;
  /** The most this client may ever be granted, whatever it asks for. */
  scopes: string[];
  /**
   * Exact-match redirect URIs. Omitted: any RFC 8252 §7.3 loopback redirect
   * (`http://localhost:*` or `http://127.0.0.1:*`), for native clients that
   * pick their callback port at run time (MCP Inspector, Claude Code).
   */
  redirectUris?: string[];
}

/** Client ID to paste into the MCP Inspector's OAuth settings (public). */
export const PUBLIC_CLIENT_ID = 'notes-inspector';

/** Client ID of the confidential client. */
export const CONFIDENTIAL_CLIENT_ID = 'notes-confidential';

/** Demo-only client secret (`client_secret_basic` or `client_secret_post`). */
export const CONFIDENTIAL_CLIENT_SECRET = 'notes-demo-secret';

export const DEMO_CLIENTS: readonly DemoClient[] = [
  {
    // Public: no secret, so PKCE (always required here) is its only proof.
    clientId: PUBLIC_CLIENT_ID,
    clientName: 'Notes Inspector',
    scopes: ['notes:read', 'notes:write'],
  },
  {
    // Confidential, and read-only: it is never granted notes:write.
    clientId: CONFIDENTIAL_CLIENT_ID,
    clientName: 'Notes Confidential',
    clientSecret: CONFIDENTIAL_CLIENT_SECRET,
    scopes: ['notes:read'],
  },
];
