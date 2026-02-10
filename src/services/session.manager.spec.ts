import { SessionManager } from './session.manager';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request } from 'express';

describe('SessionManager', () => {
  let manager: SessionManager;
  let mockTransport: StreamableHTTPServerTransport;
  let mockRequest: Request;

  beforeEach(() => {
    manager = new SessionManager();
    mockTransport = {} as StreamableHTTPServerTransport;
    mockRequest = {} as Request;
  });

  describe('setSession', () => {
    it('should store a session with lastActivity timestamp', () => {
      const now = Date.now();
      manager.setSession('session1', {
        transport: mockTransport,
        request: mockRequest,
      });

      const session = manager.getSession('session1');
      expect(session).toBeDefined();
      expect(session?.transport).toBe(mockTransport);
      expect(session?.request).toBe(mockRequest);
      expect(session?.lastActivity).toBeGreaterThanOrEqual(now);
    });
  });

  describe('getSession', () => {
    it('should return undefined for non-existent session', () => {
      const session = manager.getSession('nonexistent');
      expect(session).toBeUndefined();
    });

    it('should return session and update lastActivity', () => {
      manager.setSession('session1', {
        transport: mockTransport,
        request: mockRequest,
      });

      const firstAccess = manager.getSession('session1');
      expect(firstAccess).toBeDefined();
      expect(firstAccess?.lastActivity).toBeDefined();
    });
  });

  describe('deleteSession', () => {
    it('should remove a session', () => {
      manager.setSession('session1', {
        transport: mockTransport,
        request: mockRequest,
      });

      expect(manager.getSession('session1')).toBeDefined();
      manager.deleteSession('session1');
      expect(manager.getSession('session1')).toBeUndefined();
    });

    it('should not throw when deleting non-existent session', () => {
      expect(() => manager.deleteSession('nonexistent')).not.toThrow();
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return 0 for no sessions', () => {
      expect(manager.getActiveSessionCount()).toBe(0);
    });

    it('should return correct count', () => {
      manager.setSession('session1', {
        transport: mockTransport,
        request: mockRequest,
      });
      expect(manager.getActiveSessionCount()).toBe(1);

      manager.setSession('session2', {
        transport: mockTransport,
        request: mockRequest,
      });
      expect(manager.getActiveSessionCount()).toBe(2);

      manager.deleteSession('session1');
      expect(manager.getActiveSessionCount()).toBe(1);
    });
  });

  describe('getInactiveSessions', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return empty array when no sessions', () => {
      const inactive = manager.getInactiveSessions(1000);
      expect(inactive).toEqual([]);
    });

    it('should return inactive sessions based on timeout', () => {
      manager.setSession('session1', {
        transport: mockTransport,
        request: mockRequest,
      });

      // Advance time by 100ms
      jest.advanceTimersByTime(100);

      manager.setSession('session2', {
        transport: mockTransport,
        request: mockRequest,
      });

      // session1 should be inactive (100ms old), session2 active (just created)
      const inactive = manager.getInactiveSessions(50);
      expect(inactive).toContain('session1');
      expect(inactive).not.toContain('session2');
    });

    it('should not return sessions within timeout', () => {
      manager.setSession('session1', {
        transport: mockTransport,
        request: mockRequest,
      });

      const inactive = manager.getInactiveSessions(1000);
      expect(inactive).toEqual([]);
    });
  });

  describe('getAllSessionIds', () => {
    it('should return empty array when no sessions', () => {
      expect(manager.getAllSessionIds()).toEqual([]);
    });

    it('should return all session IDs', () => {
      manager.setSession('session1', {
        transport: mockTransport,
        request: mockRequest,
      });
      manager.setSession('session2', {
        transport: mockTransport,
        request: mockRequest,
      });

      const ids = manager.getAllSessionIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('session1');
      expect(ids).toContain('session2');
    });
  });
});
