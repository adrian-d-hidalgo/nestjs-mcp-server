import { ResourceUriHandlerArgs } from './resource-uri.args';

describe('ResourceUriHandlerArgs', () => {
  const uri = new URL('users://list');
  const extra = {
    headers: { foo: 'bar' },
    signal: new AbortController().signal,
    requestId: 'test',
    sendNotification: jest.fn(),
    sendRequest: jest.fn(),
  };

  it('should construct with static from', () => {
    const args = ResourceUriHandlerArgs.from(uri, extra);
    expect(args.uri).toBe(uri);
    expect(args.extra).toBe(extra);
  });

  it('should construct with a different URI scheme', () => {
    const fileUri = new URL('file:///tmp/test.txt');
    const args = ResourceUriHandlerArgs.from(fileUri, extra);
    expect(args.uri).toBe(fileUri);
    expect(args.extra).toBe(extra);
  });

  it('should construct with minimal extra (headers, signal)', () => {
    const minimalExtra = {
      headers: { bar: 'baz' },
      signal: new AbortController().signal,
      requestId: 'minimal',
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
    };
    const args = ResourceUriHandlerArgs.from(uri, minimalExtra);
    expect(args.uri).toBe(uri);
    expect(args.extra).toBe(minimalExtra);
  });

  it('should construct with empty headers', () => {
    const emptyHeadersExtra = {
      headers: {},
      signal: new AbortController().signal,
      requestId: 'empty',
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
    };
    const args = ResourceUriHandlerArgs.from(uri, emptyHeadersExtra);
    expect(args.uri).toBe(uri);
    expect(args.extra).toBe(emptyHeadersExtra);
  });
});
