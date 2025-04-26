import { Test, TestingModule } from '@nestjs/testing';

import { McpService } from './mcp.service';
import { McpModule } from './mcp.module';

describe('NestjsMcpServerService', () => {
  let service: McpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        McpModule.forRoot({
          name: 'test',
          version: '1.0.0',
        }),
      ],
    }).compile();

    service = module.get<McpService>(McpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
