import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AsyncLocalStorage } from 'async_hooks';

import { DiscoveryService } from '../../services/discovery.service';
import { McpLoggerService } from '../../services/logger.service';
import { RegistryService } from '../../services/registry.service';
import { StreamableService } from './streamable.service';

describe('StreamableService', () => {
  let service: StreamableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        StreamableService,
        McpLoggerService,
        RegistryService,
        DiscoveryService,
        {
          provide: AsyncLocalStorage,
          useValue: new AsyncLocalStorage(),
        },
        {
          provide: 'MCP_SERVER_OPTIONS',
          useValue: { serverInfo: {}, options: {} },
        },
        {
          provide: 'MCP_TRANSPORT_OPTIONS',
          useValue: { streamable: { options: {} } },
        },
      ],
    }).compile();

    service = module.get<StreamableService>(StreamableService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
