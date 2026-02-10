import { Logger } from '@nestjs/common';
import { McpLoggerService } from './logger.service';

describe('McpLoggerService', () => {
  let service: McpLoggerService;
  let debugSpy: jest.SpyInstance;
  let verboseSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    verboseSpy = jest.spyOn(Logger.prototype, 'verbose').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with default options', () => {
    beforeEach(() => {
      service = new McpLoggerService();
    });

    it('should be enabled by default', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should have verbose level by default', () => {
      expect(service.getLevel()).toBe('verbose');
    });

    it('should log debug messages when level is debug', () => {
      service = new McpLoggerService({ level: 'debug' });
      service.debug('test debug');
      expect(debugSpy).toHaveBeenCalledWith('test debug', '@mcp');
    });

    it('should log verbose messages', () => {
      service.verbose('test verbose');
      expect(verboseSpy).toHaveBeenCalledWith('test verbose', '@mcp');
    });

    it('should log info messages', () => {
      service.log('test log');
      expect(logSpy).toHaveBeenCalledWith('test log', '@mcp');
    });

    it('should log warn messages', () => {
      service.warn('test warn');
      expect(warnSpy).toHaveBeenCalledWith('test warn', '@mcp');
    });

    it('should log error messages', () => {
      service.error('test error', 'stack trace');
      expect(errorSpy).toHaveBeenCalledWith(
        'test error',
        'stack trace',
        '@mcp',
      );
    });

    it('should format context correctly', () => {
      service.log('test', 'MyContext');
      expect(logSpy).toHaveBeenCalledWith('test', '@mcp:MyContext');
    });
  });

  describe('with disabled logging', () => {
    beforeEach(() => {
      service = new McpLoggerService({ enabled: false });
    });

    it('should not log when disabled', () => {
      service.debug('test');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should return false for isEnabled', () => {
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('with custom log level', () => {
    it('should not log debug when level is log', () => {
      service = new McpLoggerService({ level: 'log' });
      service.debug('test');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should not log verbose when level is log', () => {
      service = new McpLoggerService({ level: 'log' });
      service.verbose('test');
      expect(verboseSpy).not.toHaveBeenCalled();
    });

    it('should log warn when level is log', () => {
      service = new McpLoggerService({ level: 'log' });
      service.warn('test');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should only log errors when level is error', () => {
      service = new McpLoggerService({ level: 'error' });

      service.debug('test');
      service.error('error test');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
