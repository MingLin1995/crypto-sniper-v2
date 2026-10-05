import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TurnstileVerificationResult {
  success: boolean;
  errorCodes?: string[];
  challengeTs?: string;
  hostname?: string;
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  constructor(private readonly configService: ConfigService) {}

  /**
   * 驗證 Cloudflare Turnstile Token
   * @param token 用戶端產生的 turnstile token (cf-turnstile-response)
   * @param remoteIp 客戶端 IP 位址 (選填)
   */
  async verify(token?: string, remoteIp?: string): Promise<TurnstileVerificationResult> {
    const isEnabled = this.configService.get<string>('TURNSTILE_ENABLED');
    const secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    // 1. 若環境設定明確停用 Turnstile (例如在 CI 或本機測試)，直接放行
    if (isEnabled === 'false') {
      return { success: true };
    }

    // 2. 若未配置 Secret Key：在非生產環境給予警告並放行；在生產環境則記錄錯誤並拒絕
    if (!secretKey) {
      if (!isProd) {
        this.logger.warn('未設定 TURNSTILE_SECRET_KEY，非生產環境預設旁路放行 Turnstile');
        return { success: true };
      }
      this.logger.error('生產環境中缺少 TURNSTILE_SECRET_KEY 設定！');
      return { success: false, errorCodes: ['missing-secret-key'] };
    }

    // 3. 檢查 Token 是否存在
    if (!token || token.trim() === '') {
      return { success: false, errorCodes: ['missing-input-response'] };
    }

    // 4. 發送請求至 Cloudflare siteverify 端點
    try {
      const formData = new URLSearchParams();
      formData.append('secret', secretKey);
      formData.append('response', token);
      if (remoteIp) {
        formData.append('remoteip', remoteIp);
      }

      const response = await fetch(this.siteverifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.logger.error(`Cloudflare Turnstile 驗證端點回應異常 HTTP ${response.status}`);
        return { success: false, errorCodes: [`http-${response.status}`] };
      }

      const data = (await response.json()) as {
        success: boolean;
        'error-codes'?: string[];
        challenge_ts?: string;
        hostname?: string;
      };

      if (!data.success) {
        this.logger.warn(
          `Cloudflare Turnstile 驗證未通過: ${JSON.stringify(data['error-codes'] || [])}`,
        );
      }

      return {
        success: Boolean(data.success),
        errorCodes: data['error-codes'],
        challengeTs: data.challenge_ts,
        hostname: data.hostname,
      };
    } catch (error: any) {
      this.logger.error(`呼叫 Cloudflare Turnstile 驗證時發生連線錯誤: ${error?.message || error}`);
      return { success: false, errorCodes: ['network-error'] };
    }
  }
}
