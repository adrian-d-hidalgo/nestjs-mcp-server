/**
 * The users of the mock authorization server.
 *
 * DEMO ONLY. Hard-coded, plain-text passwords, published in this repository
 * on purpose so anyone can sign in from the MCP Inspector and watch a per-user
 * scope policy at work. A real authorization server stores password hashes
 * (or delegates to an identity provider) and never ships users in source.
 */

export interface DemoUser {
  /** Login name; also the access token's `sub` claim. */
  username: string;
  password: string;
  /** The most this user may ever grant, whatever the client asks for. */
  scopes: string[];
}

export const DEMO_USERS: readonly DemoUser[] = [
  {
    username: 'alice',
    password: 'alice-password',
    scopes: ['notes:read', 'notes:write'],
  },
  { username: 'bob', password: 'bob-password', scopes: ['notes:read'] },
];
