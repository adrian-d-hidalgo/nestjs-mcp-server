import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  Optional,
} from '@nestjs/common';

import { MCP_LOGGING_OPTIONS } from '../mcp.constants';
import { McpLoggingOptions } from '../mcp.types';

/**
 * Servicio especializado de logging para el servidor MCP
 */
@Injectable()
export class McpLoggerService implements LoggerService {
  private readonly logger: Logger;
  private readonly options: Required<McpLoggingOptions>;

  constructor(
    @Optional() @Inject(MCP_LOGGING_OPTIONS) options?: McpLoggingOptions,
  ) {
    this.options = {
      enabled: options?.enabled !== false, // Habilitado por defecto
      level: options?.level || 'verbose',
    };

    this.logger = new Logger('MCP');
  }

  /**
   * Registra un mensaje de nivel debug
   */
  debug(message: string, context?: string): void {
    if (
      !this.options.enabled ||
      this.getLevelValue(this.options.level) > this.getLevelValue('debug')
    ) {
      return;
    }

    const formattedContext = this.formatContext(context);
    this.logger.debug(message, formattedContext);
  }

  /**
   * Registra un mensaje de nivel verbose (detallado)
   */
  verbose(message: string, context?: string): void {
    if (
      !this.options.enabled ||
      this.getLevelValue(this.options.level) > this.getLevelValue('verbose')
    ) {
      return;
    }

    const formattedContext = this.formatContext(context);
    this.logger.verbose(message, formattedContext);
  }

  /**
   * Registra un mensaje de nivel log (información)
   */
  log(message: string, context?: string): void {
    if (
      !this.options.enabled ||
      this.getLevelValue(this.options.level) > this.getLevelValue('log')
    ) {
      return;
    }

    const formattedContext = this.formatContext(context);
    this.logger.log(message, formattedContext);
  }

  /**
   * Registra un mensaje de nivel warn (advertencia)
   */
  warn(message: string, context?: string): void {
    if (
      !this.options.enabled ||
      this.getLevelValue(this.options.level) > this.getLevelValue('warn')
    ) {
      return;
    }

    const formattedContext = this.formatContext(context);
    this.logger.warn(message, formattedContext);
  }

  /**
   * Registra un mensaje de nivel error
   */
  error(message: string, trace?: string, context?: string): void {
    if (
      !this.options.enabled ||
      this.getLevelValue(this.options.level) > this.getLevelValue('error')
    ) {
      return;
    }

    const formattedContext = this.formatContext(context);
    this.logger.error(message, trace, formattedContext);
  }

  /**
   * Método para determinar si el logging está habilitado
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Método para obtener el nivel actual de logging
   */
  getLevel(): string {
    return this.options.level;
  }

  /**
   * Formatea el contexto para añadirle el prefijo '@mcp'
   */
  private formatContext(context?: string): string {
    if (!context) {
      return '@mcp';
    }
    return `@mcp:${context}`;
  }

  /**
   * Convierte un nivel de log a un valor numérico para comparaciones
   */
  private getLevelValue(level: string): number {
    const levels: Record<string, number> = {
      debug: 0,
      verbose: 1,
      log: 2,
      warn: 3,
      error: 4,
    };

    return levels[level] ?? 2; // Por defecto, nivel 'log'
  }
}
