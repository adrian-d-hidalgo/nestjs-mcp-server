import { Prompt, Resolver, Resource, Tool } from '../decorators';
import { discoveryOver } from '../services/registry.service.test-helpers';
import {
  buildPublicIndex,
  isPublicRequest,
  type PublicCapabilityIndex,
} from './public-access';

@Resolver('catalog')
class CatalogResolver {
  @Tool({ name: 'search', public: true })
  search() {}

  @Tool({ name: 'delete_all' })
  deleteAll() {}

  @Prompt({ name: 'greet', public: true })
  greet() {}

  @Prompt({ name: 'admin_prompt', scopes: ['admin'] })
  adminPrompt() {}

  @Resource({ name: 'readme', uri: 'docs://readme', public: true })
  readme() {}

  @Resource({ name: 'page', template: 'docs://pages/{slug}', public: true })
  page() {}

  @Resource({ name: 'secret', uri: 'docs://secret' })
  secret() {}
}

@Resolver({ public: true })
class OpenResolver {
  @Tool({ name: 'status' })
  status() {}

  @Tool({ name: 'private_status', public: false })
  privateStatus() {}
}

@Resolver('closed')
class ClosedResolver {
  @Tool({ name: 'closed_tool' })
  closedTool() {}
}

const call = (method: string, params?: Record<string, unknown>) => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  ...(params ? { params } : {}),
});

describe('public access', () => {
  describe('buildPublicIndex', () => {
    it('is undefined when no capability is public', () => {
      expect(buildPublicIndex(discoveryOver(ClosedResolver))).toBeUndefined();
    });

    it('indexes public tools, prompts, resources and templates, honouring resolver defaults', () => {
      const index = buildPublicIndex(
        discoveryOver(CatalogResolver, OpenResolver),
      ) as PublicCapabilityIndex;

      expect([...index.tools].sort()).toEqual(['search', 'status']);
      expect([...index.prompts]).toEqual(['greet']);
      expect([...index.resources]).toEqual(['docs://readme']);
      expect(index.templates).toHaveLength(1);
    });
  });

  describe('isPublicRequest', () => {
    const index = buildPublicIndex(
      discoveryOver(CatalogResolver),
    ) as PublicCapabilityIndex;

    it.each([
      ['initialize', call('initialize', { protocolVersion: '2025-06-18' })],
      ['server/discover', call('server/discover')],
      ['ping', call('ping')],
      [
        'a notification',
        { jsonrpc: '2.0', method: 'notifications/initialized' },
      ],
      ['tools/list', call('tools/list')],
      ['prompts/list', call('prompts/list')],
      ['resources/list', call('resources/list')],
      ['resources/templates/list', call('resources/templates/list')],
      ['a public tool call', call('tools/call', { name: 'search' })],
      ['a public prompt get', call('prompts/get', { name: 'greet' })],
      [
        'a public resource read',
        call('resources/read', { uri: 'docs://readme' }),
      ],
      [
        'a public template read',
        call('resources/read', { uri: 'docs://pages/intro' }),
      ],
      [
        'a batch of public messages',
        [call('initialize'), call('tools/call', { name: 'search' })],
      ],
    ])('admits %s', (_label, body) => {
      expect(isPublicRequest(body, index)).toBe(true);
    });

    it.each([
      ['a protected tool call', call('tools/call', { name: 'delete_all' })],
      ['a scoped prompt get', call('prompts/get', { name: 'admin_prompt' })],
      [
        'a protected resource read',
        call('resources/read', { uri: 'docs://secret' }),
      ],
      ['a tool call without a name', call('tools/call', {})],
      ['a read without a uri', call('resources/read', { uri: 42 })],
      ['another method', call('logging/setLevel', { level: 'debug' })],
      [
        'a batch holding one protected message',
        [call('tools/list'), call('tools/call', { name: 'delete_all' })],
      ],
      ['an empty batch', []],
      ['a response message', { jsonrpc: '2.0', id: 1, result: {} }],
      ['a missing body', undefined],
      ['an empty object', {}],
      ['a string body', 'tools/list'],
      ['a null message in a batch', [null]],
    ])('refuses %s', (_label, body) => {
      expect(isPublicRequest(body, index)).toBe(false);
    });
  });
});
