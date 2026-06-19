import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService, LogLevel, LogType } from '../logger/logger.service';
import { maskSensitiveData } from '../utils/mask-sensitive.helper';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private logger: LoggerService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;
    } else {
      message = exception.message || '內部伺服器錯誤';
    }

    const taipeiTime = new Date().toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
    });

    const { method, url, ip, headers, body, params, query, user } = request;
    const userAgent = headers['user-agent'] || 'Unknown';
    const userId = (user as any)?.sub;
    const userAccount = (user as any)?.account;

    const logMessage = exception instanceof HttpException
      ? message
      : (exception instanceof Error ? exception.message : '內部伺服器錯誤');

    this.logger.log({
      level: LogLevel.ERROR,
      type: LogType.ERROR,
      message: `[${method}] ${url} - ${logMessage}`,
      errorType: exception.constructor.name,
      errorStack: exception instanceof Error ? exception.stack : undefined,
      method,
      url,
      statusCode: status,
      requestBody: maskSensitiveData(body),
      requestParams: params,
      requestQuery: query,
      clientIp: ip,
      userAgent,
      userId,
      userAccount,
      metadata: {
        timestamp: taipeiTime,
        // 如果是 HttpException，記錄額外的 response 資訊
        ...(exception instanceof HttpException && {
          exceptionResponse: exception.getResponse(),
        }),
      },
    });

    const clientMessage = exception instanceof HttpException ? message : '內部伺服器錯誤';

    const errorResponse: any = {
      statusCode: status,
      message: Array.isArray(clientMessage) ? clientMessage : [clientMessage],
      error: exception instanceof HttpException ? exception.name : 'Internal Server Error',
      timestamp: taipeiTime,
      path: url,
    };

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const { message: _, error: __, statusCode: ___, ...extra } = exceptionResponse as any;
        Object.assign(errorResponse, extra);
      }
    }

    response.status(status).json(errorResponse);
  }
}
