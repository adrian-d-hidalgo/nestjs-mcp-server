import { Test, TestingModule } from '@nestjs/testing';
import { McpLoggerService } from './logger.service';

describe('McpLoggerService', () => {
  let service: McpLoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McpLoggerService],
    }).compile();

    service = module.get(McpLoggerService);
    // Silenciar logger de NestJS
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'debug').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'verbose').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log without error', () => {
    expect(() => service.log('test')).not.toThrow();
    expect(() => service.debug('test')).not.toThrow();
    expect(() => service.verbose('test')).not.toThrow();
    expect(() => service.warn('test')).not.toThrow();
    expect(() => service.error('test')).not.toThrow();
  });

  it('should return enabled and level', () => {
    expect(typeof service.isEnabled()).toBe('boolean');
    expect(typeof service.getLevel()).toBe('string');
  });
});
