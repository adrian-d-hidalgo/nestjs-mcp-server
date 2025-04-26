import { Test, TestingModule } from '@nestjs/testing';

import { AppService } from './mcp.service';
import { McpModule } from './mcp.module';

describe('NestjsMcpServerService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        McpModule.forRoot({
          name: 'test',
          version: '1.0.0',
        }),
      ],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
