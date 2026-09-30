import { MockAuthorizationServer } from '../examples/oauth/mock-authorization-server';
import {
  BootedExample,
  bootExample,
  JsonRpcBody,
  postToolCall,
  shutdown,
} from './support/oauth';

/**
 * `OAUTH_FORCE_UNAUTHORIZED` / `OAUTH_FORCE_AUTHORIZED`: the app's own
 * authorization layer (a resolver guard, and tool scopes computed at boot),
 * distinct from the authorization server and from the library's scope check.
 */
describe('OAuth example: forced authorization outcomes (e2e)', () => {
  const DENIED = 'Denied by OAUTH_FORCE_UNAUTHORIZED';

  /** Mints a token for `example` carrying exactly `scope`. */
  const tokenFor = (example: BootedExample, scope: string): Promise<string> =>
    example.app.get(MockAuthorizationServer).issueAccessToken({
      audience: example.resource,
      clientId: 'forced-outcomes-e2e',
      subject: 'alice',
      scope,
    });

  const call = async (
    example: BootedExample,
    name: string,
    args: Record<string, unknown>,
    scope: string,
  ): Promise<{ response: Response; body: JsonRpcBody }> => {
    const response = await postToolCall(
      example.resource,
      name,
      args,
      await tokenFor(example, scope),
    );
    const text = await response.text();
    return {
      response,
      body: (text ? JSON.parse(text) : {}) as JsonRpcBody,
    };
  };

  const expectDenied = (body: JsonRpcBody): void => {
    expect(body.result?.isError === true || body.error !== undefined).toBe(
      true,
    );
    expect(JSON.stringify(body)).toContain(DENIED);
  };

  const expectSucceeded = (response: Response, body: JsonRpcBody): void => {
    expect(response.status).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.result?.isError).toBeFalsy();
    expect(JSON.stringify(body)).not.toContain(DENIED);
  };

  describe('OAUTH_FORCE_UNAUTHORIZED=add_note', () => {
    let example: BootedExample;

    beforeAll(async () => {
      example = await bootExample({ OAUTH_FORCE_UNAUTHORIZED: 'add_note' });
    });

    afterAll(() => shutdown(example));

    it('refuses add_note even with a token holding every scope', async () => {
      const { body } = await call(
        example,
        'add_note',
        { text: 'x' },
        'notes:read notes:write',
      );

      expectDenied(body);
    });

    it('leaves the tools it does not list alone', async () => {
      const { response, body } = await call(
        example,
        'list_notes',
        {},
        'notes:read notes:write',
      );

      expectSucceeded(response, body);
    });
  });

  describe('OAUTH_FORCE_AUTHORIZED=list_notes,whoami and OAUTH_FORCE_UNAUTHORIZED=whoami', () => {
    let example: BootedExample;

    beforeAll(async () => {
      example = await bootExample({
        OAUTH_FORCE_AUTHORIZED: ' list_notes , whoami ',
        OAUTH_FORCE_UNAUTHORIZED: 'whoami',
      });
    });

    afterAll(() => shutdown(example));

    it('lets a token without any notes:* scope call an open tool', async () => {
      const { response, body } = await call(example, 'list_notes', {}, '');

      expectSucceeded(response, body);
    });

    it('still answers a non-listed write tool with 403 insufficient_scope', async () => {
      const { response } = await call(
        example,
        'add_note',
        { text: 'x' },
        'notes:read',
      );

      expect(response.status).toBe(403);
      const challenge = response.headers.get('www-authenticate') ?? '';
      expect(challenge).toContain('error="insufficient_scope"');
      expect(challenge).toContain('scope="notes:write"');
    });

    it('refuses a tool listed in both: unauthorized wins', async () => {
      const { body } = await call(
        example,
        'whoami',
        {},
        'notes:read notes:write',
      );

      expectDenied(body);
    });
  });

  describe('OAUTH_FORCE_AUTHORIZED=add_note', () => {
    let example: BootedExample;

    beforeAll(async () => {
      example = await bootExample({ OAUTH_FORCE_AUTHORIZED: 'add_note' });
    });

    afterAll(() => shutdown(example));

    it('lets a notes:read-only token call add_note', async () => {
      const { response, body } = await call(
        example,
        'add_note',
        { text: 'forced open' },
        'notes:read',
      );

      expectSucceeded(response, body);
    });
  });
});
