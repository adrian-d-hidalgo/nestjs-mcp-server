import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';

import { DiscoveryService } from '../../services/discovery.service';
import { McpLoggerService } from '../../services/logger.service';
import { RegistryService } from '../../services/registry.service';
import { SessionManager } from '../../services/session.manager';
import { StreamableService } from './streamable.service';

describe('StreamableService', () => {
  let service: StreamableService;
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
    // Silence console.error from SDK internals during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        StreamableService,
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
          provide: 'MCP_TRANSPORT_OPTIONS',
          useValue: { streamable: { enabled: true, options: {} } },
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

    service = module.get<StreamableService>(StreamableService);
    sessionManager = module.get<SessionManager>(SessionManager);
    logger = module.get<McpLoggerService>(McpLoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handlePostRequest', () => {
    it('should return 400 when no session ID and not initialize request', async () => {
      const req = createMockRequest({
        headers: {},
        body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      });
      const res = createMockResponse();

      await service.handlePostRequest(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
    });

    it('should return 400 with invalid session error when session does not exist', async () => {
      const req = createMockRequest({
        headers: { 'mcp-session-id': 'non-existent-session' },
        body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      });
      const res = createMockResponse();

      await service.handlePostRequest(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
    });

    it('should throw error when session exists but transport is invalid', async () => {
      const sessionId = 'test-session-id';
      sessionManager.setSession(sessionId, {
        transport: {} as unknown as StreamableHTTPServerTransport,
        request: {} as Request,
      });

      const req = createMockRequest({
        headers: { 'mcp-session-id': sessionId },
        body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      });
      const res = createMockResponse();

      await expect(
        service.handlePostRequest(req as Request, res as Response),
      ).rejects.toThrow('Invalid transport');

      sessionManager.deleteSession(sessionId);
    });

    it('should attempt to create new transport for initialize request', async () => {
      const mockServer = {
        connect: jest.fn().mockResolvedValue(undefined),
      };
      const createServerSpy = jest
        .spyOn(service as any, 'createServer')
        .mockReturnValue(mockServer);

      const req = createMockRequest({
        headers: {},
        body: {
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
          id: 1,
        },
      });
      const res = createMockResponse();

      await expect(
        service.handlePostRequest(req as Request, res as Response),
      ).rejects.toThrow();

      expect(createServerSpy).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(400);
    });
  });

  describe('handleGetRequest', () => {
    it('should return 400 when session ID is missing', async () => {
      const req = createMockRequest({ headers: {} });
      const res = createMockResponse();

      await service.handleGetRequest(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid or missing session ID');
    });

    it('should return 400 when session not found', async () => {
      const req = createMockRequest({
        headers: { 'mcp-session-id': 'non-existent-session' },
      });
      const res = createMockResponse();

      await service.handleGetRequest(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid or missing session ID');
    });

    it('should throw error when transport type is invalid', async () => {
      const sessionId = 'test-session-id';
      sessionManager.setSession(sessionId, {
        transport: {} as unknown as StreamableHTTPServerTransport,
        request: {} as Request,
      });

      const req = createMockRequest({
        headers: { 'mcp-session-id': sessionId },
      });
      const res = createMockResponse();

      await expect(
        service.handleGetRequest(req as Request, res as Response),
      ).rejects.toThrow('Invalid transport');

      sessionManager.deleteSession(sessionId);
    });
  });

  describe('handleDeleteRequest', () => {
    it('should return 400 when session ID is missing', async () => {
      const req = createMockRequest({ headers: {} });
      const res = createMockResponse();

      await service.handleDeleteRequest(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing sessionId' });
    });

    it('should throw error when session not found', async () => {
      const req = createMockRequest({
        headers: { 'mcp-session-id': 'non-existent-session' },
      });
      const res = createMockResponse();

      await expect(
        service.handleDeleteRequest(req as Request, res as Response),
      ).rejects.toThrow('Session not found');
    });

    it('should return 400 for invalid session ID format', async () => {
      const sessionId = 'invalid-format';
      const mockTransport = {
        close: jest.fn().mockResolvedValue(undefined),
        sessionId,
      };

      sessionManager.setSession(sessionId, {
        transport: mockTransport as unknown as StreamableHTTPServerTransport,
        request: {} as Request,
      });

      const req = createMockRequest({
        headers: { 'mcp-session-id': sessionId },
      });
      const res = createMockResponse();

      await service.handleDeleteRequest(req as Request, res as Response);

      expect(mockTransport.close).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid sessionId format',
      });
    });

    it('should successfully close transport with valid UUID session ID', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const mockTransport = {
        close: jest.fn().mockResolvedValue(undefined),
        sessionId,
      };

      sessionManager.setSession(sessionId, {
        transport: mockTransport as unknown as StreamableHTTPServerTransport,
        request: {} as Request,
      });

      const req = createMockRequest({
        headers: { 'mcp-session-id': sessionId },
      });
      const res = createMockResponse();

      jest.spyOn(logger, 'debug').mockImplementation(() => {});

      await service.handleDeleteRequest(req as Request, res as Response);

      expect(mockTransport.close).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, sessionId });
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });

    it('should return 404 when transport is undefined', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';

      sessionManager.setSession(sessionId, {
        transport: undefined as unknown as StreamableHTTPServerTransport,
        request: {} as Request,
      });

      const req = createMockRequest({
        headers: { 'mcp-session-id': sessionId },
      });
      const res = createMockResponse();

      jest.spyOn(logger, 'debug').mockImplementation(() => {});

      await service.handleDeleteRequest(req as Request, res as Response);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Transport not found',
        sessionId,
      });
    });
  });

  describe('onModuleInit', () => {
    it('should register all capabilities and log initialization', () => {
      const logSpy = jest.spyOn(logger, 'log').mockImplementation(() => {});

      service.onModuleInit();

      expect(logSpy).toHaveBeenCalledWith(
        'MCP STREAMEABLE initialization completed',
      );

      // Cleanup to prevent open handles
      service.onModuleDestroy();
    });
  });

  afterAll(() => {
    // Ensure cleanup timer is cleared
    service.onModuleDestroy();
  });
});
