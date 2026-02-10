import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';

import { DiscoveryService } from '../../services/discovery.service';
import { McpLoggerService } from '../../services/logger.service';
import { RegistryService } from '../../services/registry.service';
import { SessionManager } from '../../services/session.manager';
import { SseService } from './sse.service';

describe('SseService', () => {
  let service: SseService;
  let sessionManager: SessionManager;
  let logger: McpLoggerService;

  const createMockRequest = (
    overrides: Partial<Request> = {},
  ): Partial<Request> => ({
    headers: {},
    body: {},
    query: {},
    ...overrides,
  });

  const createMockResponse = (): Partial<Response> => {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      on: jest.fn(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    return res;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        SseService,
        McpLoggerService,
        RegistryService,
        SessionManager,
        DiscoveryService,
        {
          provide: 'MCP_SERVER_OPTIONS',
          useValue: {
            serverInfo: { name: 'test-server', version: '1.0.0' },
            options: {},
          },
        },
        {
          provide: 'MCP_SESSION_OPTIONS',
          useValue: {
            sessionTimeoutMs: 1800000,
            cleanupIntervalMs: 300000,
            maxConcurrentSessions: 1000,
          },
        },
      ],
    }).compile();

    service = module.get<SseService>(SseService);
    sessionManager = module.get<SessionManager>(SessionManager);
    logger = module.get<McpLoggerService>(McpLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleMessage', () => {
    it('should return 400 when sessionId is missing', async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();

      await service.handleMessage(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid or missing sessionId');
    });

    it('should return 400 when session not found', async () => {
      const req = createMockRequest({
        query: { sessionId: 'non-existent-session' },
      });
      const res = createMockResponse();

      await service.handleMessage(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid or missing sessionId');
    });

    it('should return 400 when transport is invalid type', async () => {
      const sessionId = 'test-session-id';
      sessionManager.setSession(sessionId, {
        transport: {} as unknown as SSEServerTransport,
        request: {} as Request,
      });

      const req = createMockRequest({
        query: { sessionId },
        body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      });
      const res = createMockResponse();

      jest.spyOn(logger, 'debug').mockImplementation(() => {});

      await service.handleMessage(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid transport');

      sessionManager.deleteSession(sessionId);
    });

    it('should handle transport errors and return 500', async () => {
      const sessionId = 'test-session-id';
      const mockTransport = {
        handlePostMessage: jest
          .fn()
          .mockRejectedValue(new Error('Transport error')),
        sessionId,
      };

      Object.setPrototypeOf(mockTransport, SSEServerTransport.prototype);

      sessionManager.setSession(sessionId, {
        transport: mockTransport as unknown as SSEServerTransport,
        request: {} as Request,
      });

      const req = createMockRequest({
        query: { sessionId },
        body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      });
      const res = createMockResponse();

      jest.spyOn(logger, 'debug').mockImplementation(() => {});
      jest.spyOn(logger, 'error').mockImplementation(() => {});

      await service.handleMessage(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Transport error',
      });

      sessionManager.deleteSession(sessionId);
    });

    it('should handle non-Error exceptions', async () => {
      const sessionId = 'test-session-id';
      const mockTransport = {
        handlePostMessage: jest.fn().mockRejectedValue('string error'),
        sessionId,
      };

      Object.setPrototypeOf(mockTransport, SSEServerTransport.prototype);

      sessionManager.setSession(sessionId, {
        transport: mockTransport as unknown as SSEServerTransport,
        request: {} as Request,
      });

      const req = createMockRequest({
        query: { sessionId },
        body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      });
      const res = createMockResponse();

      jest.spyOn(logger, 'debug').mockImplementation(() => {});
      jest.spyOn(logger, 'error').mockImplementation(() => {});

      await service.handleMessage(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Unknown error',
      });

      sessionManager.deleteSession(sessionId);
    });

    it('should successfully handle message with valid transport', async () => {
      const sessionId = 'test-session-id';
      const mockTransport = {
        handlePostMessage: jest.fn().mockResolvedValue(undefined),
        sessionId,
      };

      Object.setPrototypeOf(mockTransport, SSEServerTransport.prototype);

      sessionManager.setSession(sessionId, {
        transport: mockTransport as unknown as SSEServerTransport,
        request: {} as Request,
      });

      const req = createMockRequest({
        query: { sessionId },
        body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      });
      const res = createMockResponse();

      jest.spyOn(logger, 'debug').mockImplementation(() => {});

      await service.handleMessage(req as Request, res as Response);

      expect(mockTransport.handlePostMessage).toHaveBeenCalledWith(
        req,
        res,
        req.body,
      );

      sessionManager.deleteSession(sessionId);
    });
  });

  describe('handleSse', () => {
    it('should create transport and register session', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      jest.spyOn(logger, 'debug').mockImplementation(() => {});

      const mockServer = {
        connect: jest.fn().mockResolvedValue(undefined),
      };
      const createServerSpy = jest
        .spyOn(service as any, 'createServer')
        .mockReturnValue(mockServer);

      await service.handleSse(req as Request, res as Response);

      expect(createServerSpy).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalled();

      const sessions = Array.from(
        (sessionManager as unknown as { sessions: Map<string, unknown> })
          .sessions,
      );
      expect(sessions.length).toBe(1);

      const sessionEntry = sessions[0];
      const sessionId = sessionEntry[0];
      sessionManager.deleteSession(sessionId);
    });

    it('should cleanup session on response close', async () => {
      const req = createMockRequest();
      let closeHandler: () => void = () => {};
      const res = {
        ...createMockResponse(),
        on: jest.fn((event: string, handler: () => void) => {
          if (event === 'close') {
            closeHandler = handler;
          }
        }),
      };

      jest.spyOn(logger, 'debug').mockImplementation(() => {});

      const mockServer = {
        connect: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(service as any, 'createServer').mockReturnValue(mockServer);

      await service.handleSse(req as Request, res as unknown as Response);

      const sessions = Array.from(
        (sessionManager as unknown as { sessions: Map<string, unknown> })
          .sessions,
      );
      const sessionEntry = sessions[0];
      const sessionId = sessionEntry[0];

      expect(sessionManager.getSession(sessionId)).toBeDefined();

      closeHandler();

      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
  });

  describe('onModuleInit', () => {
    it('should log initialization', () => {
      const logSpy = jest.spyOn(logger, 'log').mockImplementation(() => {});

      service.onModuleInit();

      expect(logSpy).toHaveBeenCalledWith(
        'MCP initialization completed',
        'MCP_SERVER',
      );
    });
  });
});
