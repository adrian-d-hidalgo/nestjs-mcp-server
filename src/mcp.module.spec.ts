/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';

import { McpCoreModule } from './mcp-core.module';
import { MCP_MODULE_OPTIONS } from './mcp.constants';
import { McpModule } from './mcp.module';
import { SessionManager } from './services/session.manager';

describe('McpModule', () => {
  describe('forRoot', () => {
    it('should create module with basic options', () => {
      const module = McpModule.forRoot({
        name: 'test-server',
        version: '1.0.0',
      });

      expect(module.module).toBe(McpModule);
      expect(module.imports).toHaveLength(1);
    });

    it('should delegate to McpCoreModule.forRoot', () => {
      const forRootSpy = jest.spyOn(McpCoreModule, 'forRoot');

      const options = {
        name: 'test-server',
        version: '1.0.0',
        logging: { enabled: true },
      };

      McpModule.forRoot(options);

      expect(forRootSpy).toHaveBeenCalledWith(options);
      forRootSpy.mockRestore();
    });

    it('should work with NestJS TestingModule', async () => {
      const testModule: TestingModule = await Test.createTestingModule({
        imports: [
          McpModule.forRoot({
            name: 'integration-test',
            version: '1.0.0',
          }),
        ],
      }).compile();

      const sessionManager = testModule.get(SessionManager);
      expect(sessionManager).toBeDefined();
    });
  });

  describe('forRootAsync', () => {
    it('should create module with async factory', () => {
      const module = McpModule.forRootAsync({
        useFactory: () => ({
          name: 'async-server',
          version: '2.0.0',
        }),
      });

      expect(module.module).toBe(McpModule);
      expect(module.imports).toHaveLength(1);
    });

    it('should delegate to McpCoreModule.forRootAsync', () => {
      const forRootAsyncSpy = jest.spyOn(McpCoreModule, 'forRootAsync');

      const options = {
        imports: [],
        useFactory: () => ({
          name: 'async-server',
          version: '1.0.0',
        }),
        inject: [],
      };

      McpModule.forRootAsync(options);

      expect(forRootAsyncSpy).toHaveBeenCalledWith(options);
      forRootAsyncSpy.mockRestore();
    });

    it('should work with NestJS TestingModule and async config', async () => {
      const testModule: TestingModule = await Test.createTestingModule({
        imports: [
          McpModule.forRootAsync({
            useFactory: async () => {
              await new Promise((resolve) => setTimeout(resolve, 5));
              return {
                name: 'async-integration-test',
                version: '2.0.0',
              };
            },
          }),
        ],
      }).compile();

      const mcpOptions = testModule.get(MCP_MODULE_OPTIONS);
      expect(mcpOptions.name).toBe('async-integration-test');
    });
  });

  describe('forFeature', () => {
    it('should create minimal module configuration', () => {
      const module = McpModule.forFeature();

      expect(module.module).toBe(McpModule);
    });

    it('should accept options parameter', () => {
      const module = McpModule.forFeature({});

      expect(module.module).toBe(McpModule);
    });

    it('should delegate to McpCoreModule.forFeature', () => {
      const forFeatureSpy = jest.spyOn(McpCoreModule, 'forFeature');

      const options = {};
      McpModule.forFeature(options);

      expect(forFeatureSpy).toHaveBeenCalledWith(options);
      forFeatureSpy.mockRestore();
    });
  });
});
