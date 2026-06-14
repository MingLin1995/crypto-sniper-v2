import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService, LogLevel, LogType } from '../logger/logger.service';
import { maskSensitiveData } from '../utils/mask-sensitive.helper';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logger: LoggerService) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers, body, params, query, user } = request;

    const userAgent = headers['user-agent'] || 'Unknown';
    const userId = user?.sub;
    const userAccount = user?.account;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        // 只記錄成功的請求（錯誤由 Exception Filter 統一處理）
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration = Date.now() - startTime;

          // 判斷是否為會改變系統狀態的操作（CUD）
          const isMutatingOperation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

          // 記錄條件：
          // 1. 所有會改變狀態的操作（POST, PATCH, PUT, DELETE）
          // 2. 非 200 的響應
          // 3. 執行時間超過 1 秒
          // 4. 啟用 LOG_ALL_REQUESTS
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
          }
        },
        error: () => {
          // 不記錄，讓 Exception Filter 處理
        },
      }),
    );
  }
}
