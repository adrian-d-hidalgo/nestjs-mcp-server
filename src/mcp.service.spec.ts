import { Test, TestingModule } from '@nestjs/testing';

import { McpModule } from './mcp.module';
import { McpService } from './mcp.service';

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
