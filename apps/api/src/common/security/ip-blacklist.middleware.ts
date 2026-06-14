import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IpBlacklistService } from './ip-blacklist.service';

@Injectable()
export class IpBlacklistMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpBlacklistMiddleware.name);

  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const ip = this.resolveClientIp(req);

    if (ip) {
      const isBlocked = await this.ipBlacklistService.isIpBlacklisted(ip);
      if (isBlocked) {
        this.logger.warn(`攔截來自被封鎖 IP 的請求：${ip} | 路徑：${req.method} ${req.originalUrl}`);
        throw new ForbiddenException('您的 IP 已被封鎖');
      }
    }

    next();
  }

  /**
   * 從請求標頭或 Socket 屬性中解析真實的客戶端 IP 位址。
   */
  private resolveClientIp(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    let ip = '';

    if (xForwardedFor) {
      // x-forwarded-for 可能為以逗號分隔的列表，最左側的 IP 為原始客戶端 IP。
      const rawIp = typeof xForwardedFor === 'string' ? xForwardedFor : xForwardedFor[0];
      ip = rawIp.split(',')[0].trim();
    } else {
      const xRealIp = req.headers['x-real-ip'];
      ip = typeof xRealIp === 'string' 
        ? xRealIp 
        : (req.ip || req.socket.remoteAddress || '');
    }

    // 規格化 IPv6 映射的 IPv4 位址（例如 ::ffff:127.0.0.1 -> 127.0.0.1）
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    // 若存在 IPv6 的方括號則予以去除（例如 [::1] -> ::1）
    if (ip.startsWith('[') && ip.endsWith(']')) {
      ip = ip.slice(1, -1);
    }

    return ip;
  }
}
