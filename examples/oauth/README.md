# OAuth 2.1 example

An MCP server protected by OAuth 2.1, runnable with no Docker and no provider
account. Next to the MCP endpoint runs a **mock authorization server that
behaves like a real provider** (Auth0/Okta-like): users log in, approve a
consent screen, clients are registered up front, and the scopes in a token are
limited by both the client and the user.

| Path                                                | What                                                           |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `POST /mcp`                                         | the MCP endpoint (`JwksJwtStrategy`, scoped tools)             |
| `GET /.well-known/oauth-protected-resource/mcp`     | RFC 9728 metadata, served by the library                       |
| `GET /.well-known/oauth-authorization-server/oauth` | RFC 8414 metadata of the mock AS (also at the root)            |
| `GET /oauth/authorize`                              | authorization endpoint: login page, then consent page          |
| `POST /oauth/login`, `POST /oauth/consent`          | the login and consent forms                                    |
| `POST /oauth/token`                                 | `authorization_code` (PKCE S256) and `refresh_token` (rotated) |
| `POST /oauth/revoke`                                | RFC 7009 token revocation                                      |
| `POST /oauth/register`                              | RFC 7591 dynamic client registration — **off by default**      |
| `GET /oauth/jwks`                                   | the RS256 public key                                           |

> **The mock authorization server (`mock-authorization-server.ts` and its
> `mock-*.ts` companions) is a test/demo mock. Never use it in production.**
> Users, clients, passwords and the client secret are **hard-coded demo
> values on purpose**; everything lives in memory and a new signing key is
> generated on every boot.

## Run it

```sh
PORT=3200 EXAMPLE=oauth pnpm start:example
```

Then point an OAuth-capable MCP client at `http://localhost:3200/mcp`:

- **MCP Inspector**: `pnpm start:inspector`, Streamable HTTP transport, URL
  `http://localhost:3200/mcp`. In **OAuth Settings** set Client ID
  `notes-inspector` (no secret), then connect.
- **Claude Code**: `claude mcp add --transport http notes-oauth http://localhost:3200/mcp`
  needs dynamic registration: start the example with
  `OAUTH_DYNAMIC_REGISTRATION=true`, then authenticate the server from `/mcp`.

The client gets a `401` with `resource_metadata`, reads the protected-resource
metadata, discovers the mock AS and opens the browser on its login page. Sign in
as one of the demo users, approve the consent screen, and the client receives
an RS256 JWT for `http://localhost:3200/mcp` with the granted scopes.

| Tool         | Requires      |
| ------------ | ------------- |
| `whoami`     | any token     |
| `list_notes` | `notes:read`  |
| `add_note`   | `notes:write` |

`hideOutOfScope` is `false`, so a token without `notes:write` still sees
`add_note` and gets `403 insufficient_scope` with `scope="notes:write"` when
calling it — the step-up challenge.

`test/oauth-flow.e2e-spec.ts` drives the whole flow (login and consent included)
with the official MCP SDK client; `test/oauth-*.e2e-spec.ts` cover the mock
authorization server, the confidential client and the forced outcomes.

## Demo users and clients

Users (sign in on the login page):

| Username | Password         | May be granted              |
| -------- | ---------------- | --------------------------- |
| `alice`  | `alice-password` | `notes:read`, `notes:write` |
| `bob`    | `bob-password`   | `notes:read`                |

Clients (registered up front, as you would in the Auth0, Okta or Keycloak
console):

| Client ID            | Secret              | Type                                                         | May request                 |
| -------------------- | ------------------- | ------------------------------------------------------------ | --------------------------- |
| `notes-inspector`    | —                   | public, PKCE (for Inspector, Claude Code)                    | `notes:read`, `notes:write` |
| `notes-confidential` | `notes-demo-secret` | confidential (`client_secret_basic` or `client_secret_post`) | `notes:read`                |

Both accept any loopback redirect URI (`http://localhost:*`,
`http://127.0.0.1:*`), because MCP clients pick their callback port.

**The scopes in a token** are what the client requested ∩ what the client may
request ∩ what the user may be granted. If nothing is left, the authorization
answers `invalid_scope`. `offline_access` is accepted and ignored.

**Dynamic client registration is off by default**, as in most providers: the
metadata has no `registration_endpoint` and `POST /oauth/register` answers
`403 access_denied`, so a client without a pre-registered ID cannot start the
flow (the MCP SDK reports "does not support dynamic client registration"). With
`OAUTH_DYNAMIC_REGISTRATION=true` the metadata advertises
`registration_endpoint` and clients that register themselves become public
clients that may request both scopes (the path claude.ai uses when it has no
pre-registered credentials).

The login page lists the demo users as a hint. A wrong username or password
answers `401` and shows the login page again. A successful login keeps a
10-minute session cookie for the mock AS, so a second authorization skips the
password but still shows the consent screen. Authorization codes live 60
seconds; access tokens 10 minutes.

## Forcing outcomes

Two variables force an authorization result for chosen tools, whatever the
token says. They are read at boot; restart the example after changing them.

| Variable                   | Value                      | Effect                                                                                                                                                         |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OAUTH_FORCE_UNAUTHORIZED` | comma-separated tool names | those tools are **always refused** once the token passes their scope check: the call returns a tool error `Denied by OAUTH_FORCE_UNAUTHORIZED (tool "<name>")` |
| `OAUTH_FORCE_AUTHORIZED`   | comma-separated tool names | those tools **require no scope**: any valid token may call them                                                                                                |

A tool listed in both is refused. With neither set, the tool table above applies.

```sh
# add_note always fails, even for alice with notes:write
OAUTH_FORCE_UNAUTHORIZED=add_note PORT=3200 EXAMPLE=oauth pnpm start:example

# add_note always works, even for bob (notes:read only)
OAUTH_FORCE_AUTHORIZED=add_note PORT=3200 EXAMPLE=oauth pnpm start:example
```

The refusal comes from a guard of the application (`@UseGuards`), not from
OAuth: it is the authorization layer an app puts on top of whatever
authentication it uses. Two consequences worth knowing:

- It answers as a **tool error** (HTTP `200`, JSON-RPC result with
  `isError: true`), not as an HTTP `403`: guards run after the MCP request was
  accepted.
- It runs **after** the per-tool scope check. A listed tool called with a token
  that lacks its scope still gets the library's `403 insufficient_scope` first;
  sign in as `alice` to see the guard refuse.

`OAUTH_FORCE_AUTHORIZED` works by declaring those tools without a `scopes`
requirement when the example boots.

## Testing failures with MCP Inspector

Start the example, run `pnpm start:inspector`, choose Streamable HTTP with URL
`http://localhost:3200/mcp`, and open **OAuth Settings**. Press **Clear stored
OAuth state** before each case, and after every restart of the example (the
mock forgets sessions, tokens and keys when it restarts).

| Setup                                                                                          | Expected result                                                                        | Who answers                        |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------- |
| Client ID **empty** (default start)                                                            | the Inspector cannot register itself: dynamic registration is off                      | authorization server               |
| Client ID `notes-unknown`                                                                      | error page on `/oauth/authorize`, no redirect back                                     | authorization server               |
| Client ID `notes-inspector`, wrong password on the login page                                  | login page again with an error                                                         | authorization server               |
| Client ID `notes-inspector`, sign in as `alice`, **Deny** on consent                           | `access_denied`                                                                        | authorization server (user)        |
| Client ID `notes-inspector`, sign in as `alice`, approve                                       | connects with both scopes; every tool works                                            | —                                  |
| Client ID `notes-inspector`, sign in as `bob`, approve                                         | connects with `notes:read`; `list_notes` works, `add_note` → `403 insufficient_scope`  | the library (per-tool `scopes`)    |
| Client ID `notes-confidential`, **wrong** secret                                               | `invalid_client` at the token step; no token                                           | authorization server               |
| Client ID `notes-confidential` + secret, sign in as `alice`                                    | token has `notes:read` only (client policy); `add_note` → `403 insufficient_scope`     | authorization server + the library |
| Client ID `notes-inspector`, Scopes `notes:read`, `alice`, Insufficient-scope **Re-authorize** | `add_note` → 403 → re-authorization (consent again) → retry succeeds                   | step-up                            |
| Started with `OAUTH_FORCE_UNAUTHORIZED=add_note`, `notes-inspector` + `alice`                  | `add_note` returns a tool error `Denied by OAUTH_FORCE_UNAUTHORIZED (tool "add_note")` | the app (guard)                    |
| Started with `OAUTH_FORCE_AUTHORIZED=add_note`, `notes-inspector` + `bob`                      | `add_note` works                                                                       | the app (no scope required)        |
| Started with `OAUTH_DYNAMIC_REGISTRATION=true`, Client ID empty                                | the Inspector registers itself, then login and consent as usual                        | —                                  |

`whoami` shows the user and scopes the server actually received, useful to
check which token the Inspector is using. To see the raw `401`, add the header
`Authorization: Bearer garbage` to a connection without OAuth.

## What the mock does not cover

- Two hard-coded users and two hard-coded clients; no user management.
- No `client_credentials` grant, no `private_key_jwt`, no OIDC (ID tokens,
  `/.well-known/openid-configuration`).
- No token introspection. Revocation invalidates refresh tokens; access tokens
  are self-contained JWTs and stay valid until they expire (10 minutes), as
  with most real JWT providers.
- No Client ID Metadata Documents (CIMD).
- In memory: sessions, codes and refresh tokens are lost on restart, and the
  signing key is regenerated (no rotation).
- No rate limiting, no HTTPS, no account lockout.
- One resource only: tokens are always issued for this example's `/mcp`.
- Refreshing never widens scopes.

## Swap the mock for a real provider

`JwksJwtStrategy` knows nothing about the mock: it verifies the signature
against a JWKS, the issuer, the expiry and the audience. Point it at any
authorization server that issues JWT access tokens:

| Variable         | Meaning                                   | Default                        |
| ---------------- | ----------------------------------------- | ------------------------------ |
| `OAUTH_ISSUER`   | the `iss` of accepted tokens              | `http://localhost:$PORT/oauth` |
| `OAUTH_JWKS_URL` | where the issuer publishes its keys       | `$OAUTH_ISSUER/jwks`           |
| `MCP_RESOURCE`   | this server's public URL, the token `aud` | `http://localhost:$PORT/mcp`   |
| `BASE_URL`       | public origin, when behind a proxy        | `http://localhost:$PORT`       |

Setting `OAUTH_ISSUER` also stops mounting the mock. Without it, the example
refuses to boot when `NODE_ENV=production` or when `BASE_URL` or
`MCP_RESOURCE` is not a loopback URL, so the demo mock never ends up public.
For example:

```sh
# Auth0: create an API whose identifier is the MCP resource URL
OAUTH_ISSUER=https://YOUR_TENANT.auth0.com/ \
OAUTH_JWKS_URL=https://YOUR_TENANT.auth0.com/.well-known/jwks.json \
MCP_RESOURCE=https://notes.example.com/mcp \
EXAMPLE=oauth pnpm start:example

# Okta (custom authorization server)
OAUTH_ISSUER=https://YOUR_ORG.okta.com/oauth2/default \
OAUTH_JWKS_URL=https://YOUR_ORG.okta.com/oauth2/default/v1/keys ...

# Keycloak
OAUTH_ISSUER=https://keycloak.example.com/realms/REALM \
OAUTH_JWKS_URL=https://keycloak.example.com/realms/REALM/protocol/openid-connect/certs ...
```

Things the provider must do for this to work:

- **Put the MCP resource URL in `aud`.** Auth0 does it when the API identifier
  is the resource URL; Keycloak needs an audience mapper; Okta takes it from the
  authorization server's audience. A token without it is rejected — by design
  (RFC 8707).
- **Issue scopes** `notes:read` and `notes:write`. The strategy reads `scope`
  (space-separated string: Auth0, Keycloak) or `scp` (array: Okta, Entra ID).
- **Support dynamic client registration** if clients should register
  themselves; otherwise pre-register the client and configure it in the MCP
  client.
- Copy `issuer` exactly, trailing slash included (`jose` compares it
  byte-for-byte).
