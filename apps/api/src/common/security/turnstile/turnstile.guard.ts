import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private readonly turnstileService: TurnstileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 若未配置私鑰或未啟用，自動放行以保證系統可用性
    if (!this.turnstileService.isConfigured()) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // 支援從 Header 或 Body 取得 Turnstile Token
    const token =
      request.headers['x-turnstile-token'] ||
      request.headers['cf-turnstile-response'] ||
      request.body?.turnstileToken ||
      request.body?.['cf-turnstile-response'];

    // 取得客戶端真實 IP (相容 Cloudflare、反向代理及 Express)
    const forwardedFor = request.headers['x-forwarded-for'];
    const clientIp =
      request.headers['cf-connecting-ip'] ||
      (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : undefined) ||
      request.ip;

    const result = await this.turnstileService.verify(token, clientIp);

    if (!result.success) {
      throw new BadRequestException('Cloudflare Turnstile 人機驗證失敗，請重試');
    }

    return true;
  }
}
