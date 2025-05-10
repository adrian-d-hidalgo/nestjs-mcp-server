import { ResourceTemplateHandlerArgs } from './resource-template.args';

describe('ResourceTemplateArgs', () => {
  const uri = new URL('https://example.com/users/:userId');
  const extra = {
    headers: { foo: 'bar' },
    signal: new AbortController().signal,
    requestId: 'test',
    sendNotification: jest.fn(),
    sendRequest: jest.fn(),
  };

  it('should create an instance', () => {
    const args = ResourceTemplateHandlerArgs.from(uri, extra);

    expect(args.uri).toBe(uri);
    expect(args.extra).toBe(extra);
    expect(args.variables).toBeUndefined();
  });

  it('should create an instance with variables', () => {
    const variables = { userId: '123' };
    const args = ResourceTemplateHandlerArgs.from(uri, extra, variables);

    expect(args.uri).toBe(uri);
    expect(args.extra).toBe(extra);
    expect(args.variables).toBe(variables);
  });
});
