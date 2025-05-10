import { Test, TestingModule } from '@nestjs/testing';

import { McpModule } from './mcp.module';
import { SseService } from './transports/sse';
import { StreamableService } from './transports/streamable';
describe('NestjsMcpServerService', () => {
  let streamableService: StreamableService;
  let sseService: SseService;

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
    sseService = module.get<SseService>(SseService);
  });

  it('should be defined', () => {
    expect(streamableService).toBeDefined();
    expect(sseService).toBeDefined();
  });
});
