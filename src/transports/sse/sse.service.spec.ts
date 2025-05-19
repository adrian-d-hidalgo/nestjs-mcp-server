import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { DiscoveryService } from '../../services/discovery.service';
import { McpLoggerService } from '../../services/logger.service';
import { RegistryService } from '../../services/registry.service';
import { SessionManager } from '../../services/session.manager';
import { SseService } from './sse.service';

describe('SseService', () => {
  let service: SseService;

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
          useValue: { serverInfo: {}, options: {} },
        },
      ],
    }).compile();

    service = module.get<SseService>(SseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
