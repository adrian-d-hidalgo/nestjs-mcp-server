import { Test, TestingModule } from '@nestjs/testing';

import { McpModule } from './mcp.module';
import { StreamableService } from './transports/streamable';

describe('NestjsMcpServerService', () => {
  let streamableService: StreamableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        McpModule.forRoot({
          name: 'test',
          version: '1.0.0',
        }),
      ],
    }).compile();

    streamableService = module.get<StreamableService>(StreamableService);
  });

  it('should be defined', () => {
    expect(streamableService).toBeDefined();
  });
});
