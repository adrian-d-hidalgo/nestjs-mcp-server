import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request } from 'express';
import { SessionManager } from './session.manager';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('should be defined', () => {
    expect(manager).toBeDefined();
  });

  it('should set, get, and delete session', () => {
    const session = {
      transport: {} as StreamableHTTPServerTransport,
      request: {} as Request,
    };

    manager.setSession('abc', session);

    expect(manager.getSession('abc')).toBe(session);

    manager.deleteSession('abc');

    expect(manager.getSession('abc')).toBeUndefined();
  });
});
