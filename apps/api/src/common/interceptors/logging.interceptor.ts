import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService, LogLevel, LogType } from '../logger/logger.service';
import { maskSensitiveData } from '../utils/mask-sensitive.helper';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private metricsService?: MetricsService;

  constructor(
    private logger: LoggerService,
    private readonly moduleRef: ModuleRef,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers, body, params, query, user } = request;

    const userAgent = headers['user-agent'] || 'Unknown';
    const userId = user?.sub;
    const userAccount = user?.account;
    const startTime = Date.now();

    // 延遲解析 MetricsService，避免循環依賴
    if (!this.metricsService) {
      try {
        this.metricsService = this.moduleRef.get(MetricsService, { strict: false });
      } catch (err) {
        // 靜默忽略
      }
    }

    return next.handle().pipe(
      tap({
        // 只記錄成功的請求
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - startTime;
          const routePath = request.route?.path || url;

          // 記錄 Prometheus 指標
          if (this.metricsService) {
            this.metricsService.httpRequestsTotal.inc({
              method,
              path: routePath,
              status: String(statusCode),
            });
            this.metricsService.httpRequestDurationSeconds.observe(
              {
                method,
                path: routePath,
                status: String(statusCode),
              },
              duration / 1000,
            );
          }

          // 判斷是否為會改變系統狀態的操作（CUD）
          const isMutatingOperation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

          const shouldLog =
            isMutatingOperation ||
            statusCode !== 200 ||
            duration > 1000 ||
            process.env.LOG_ALL_REQUESTS === 'true';

          if (shouldLog) {
            this.logger.log({
              level: statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
              type: LogType.REQUEST,
              message: `${method} ${url} - ${statusCode}`,
              method,
              url,
              statusCode,
              duration,
              requestBody: maskSensitiveData(body),
              requestParams: params,
              requestQuery: query,
              clientIp: ip,
              userAgent,
              userId,
              userAccount,
            });
            // 標記已記錄日誌
            request.__systemLogged = true;
          }
        },
        error: (error: any) => {
          const statusCode = error instanceof HttpException ? error.getStatus() : 500;
          const duration = Date.now() - startTime;
          const routePath = request.route?.path || url;

          // 記錄 Prometheus 指標
          if (this.metricsService) {
            this.metricsService.httpRequestsTotal.inc({
              method,
              path: routePath,
              status: String(statusCode),
            });
            this.metricsService.httpRequestDurationSeconds.observe(
              {
                method,
                path: routePath,
                status: String(statusCode),
              },
              duration / 1000,
            );
          }

          let logMessage: string;
          if (error instanceof HttpException) {
            const exceptionResponse = error.getResponse();
            logMessage =
              typeof exceptionResponse === 'string'
                ? exceptionResponse
                : (exceptionResponse as any).message || error.message;
          } else {
            logMessage = error.message || '內部伺服器錯誤';
          }

          this.logger.log({
            level: LogLevel.ERROR,
            type: LogType.ERROR,
            message: `[${method}] ${url} - ${logMessage}`,
            errorType: error.constructor.name,
            errorStack: error instanceof Error ? error.stack : undefined,
            method,
            url,
            statusCode,
            duration,
            requestBody: maskSensitiveData(body),
            requestParams: params,
            requestQuery: query,
            clientIp: ip,
            userAgent,
            userId,
            userAccount,
          });

          // 標記已記錄日誌，避免 Exception Filter 重複寫入
          request.__systemLogged = true;
        },
      }),
    );
  }
}
