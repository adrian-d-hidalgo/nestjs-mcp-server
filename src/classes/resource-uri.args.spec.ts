/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { ResourceUriHandlerArgs } from './resource-uri.args';

describe('ResourceUriHandlerArgs', () => {
  const uri = new URL('users://list');
  const extra = {
    request: {} as any,
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

  it('should construct with minimal extra', () => {
    const minimalExtra = {
      request: {} as any,
      signal: new AbortController().signal,
      requestId: 'minimal',
      sendNotification: jest.fn(),
      sendRequest: jest.fn(),
    };
    const args = ResourceUriHandlerArgs.from(uri, minimalExtra);
    expect(args.uri).toBe(uri);
    expect(args.extra).toBe(minimalExtra);
  });
});
