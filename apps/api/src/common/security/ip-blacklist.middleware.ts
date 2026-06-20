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
   * 從請求屬性中取得 Express 已解析（且受 trust proxy 保護）的真實客戶端 IP。
   */
  private resolveClientIp(req: Request): string {
    let ip = req.ip || req.socket.remoteAddress || '';

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
