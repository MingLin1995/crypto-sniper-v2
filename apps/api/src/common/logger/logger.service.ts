import { Injectable, OnModuleInit, ConsoleLogger } from '@nestjs/common';
import { ExtendedPrismaService } from '../prisma/extended-prisma.service';
import { safeStringify } from '../utils/mask-sensitive.helper';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export enum LogType {
  REQUEST = 'REQUEST',
  ERROR = 'ERROR',
}

export interface LogOptions {
  level: LogLevel;
  type: LogType;
  message: string;
  errorType?: string;
  errorStack?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  requestBody?: any;
  requestParams?: any;
  requestQuery?: any;
  clientIp?: string;
  userAgent?: string;
  userId?: string;
  userAccount?: string;
  metadata?: any;
}

@Injectable()
export class LoggerService extends ConsoleLogger implements OnModuleInit {
  constructor(private prisma: ExtendedPrismaService) {
    super('LoggerService');
  }

  onModuleInit() { }

  /**
   * 記錄日誌（存入資料庫 + Console 輸出）
   * 成功的 REQUEST 只存資料庫不印 console，ERROR 才印 console
   */
  async log(options: LogOptions): Promise<void> {
    const {
      level,
      type,
      message,
      errorType,
      errorStack,
      method,
      url,
      statusCode,
      duration,
      userId,
      clientIp,
      metadata,
    } = options;

    const shouldOutputConsole =
      type === LogType.ERROR || level === LogLevel.WARN || level === LogLevel.ERROR;

    if (shouldOutputConsole) {
      const consoleMessage = `[${type}] ${message}`;
      const context = {
        method,
        url,
        statusCode,
        duration,
        userId,
        clientIp,
        errorType,
        ...metadata,
      };

      switch (level) {
        case LogLevel.ERROR:
          super.error(consoleMessage, errorStack || '', context);
          break;
        case LogLevel.WARN:
          super.warn(consoleMessage, context);
          break;
        default:
          super.log(consoleMessage, context);
      }
    }

    this.saveToDatabase(options).catch((error) => {
      // 如果資料庫寫入失敗，只輸出到 Console，不影響主流程
      super.error('Failed to save log to database', (error as Error).message);
    });
  }

  private async saveToDatabase(options: LogOptions): Promise<void> {
    try {
      await this.prisma.client.systemLog.create({
        data: {
          level: options.level,
          type: options.type,
          message: options.message,
          errorType: options.errorType,
          errorStack: options.errorStack,
          method: options.method,
          url: options.url,
          statusCode: options.statusCode,
          duration: options.duration,
          requestBody: safeStringify(options.requestBody),
          requestParams: safeStringify(options.requestParams),
          requestQuery: safeStringify(options.requestQuery),
          clientIp: options.clientIp,
          userAgent: options.userAgent,
          userId: options.userId,
          userAccount: options.userAccount,
          metadata: options.metadata ? (options.metadata as any) : undefined,
        },
      });
    } catch (error) {
      // 靜默失敗，避免 log 系統影響主業務
      throw error;
    }
  }
}
