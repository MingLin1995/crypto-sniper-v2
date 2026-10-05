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
   * 檢查 Turnstile 是否已完整配置私鑰並啟用
   */
  isConfigured(): boolean {
    const isEnabled = this.configService.get<string>('TURNSTILE_ENABLED');
    const secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY');
    if (isEnabled === 'false') {
      return false;
    }
    return Boolean(secretKey && secretKey.trim().length > 0);
  }

  /**
   * 取得公鑰 (Site Key)
   */
  getSiteKey(): string {
    return (
      this.configService.get<string>('NEXT_PUBLIC_TURNSTILE_SITE_KEY') ||
      this.configService.get<string>('TURNSTILE_SITE_KEY') ||
      ''
    );
  }

  /**
   * 驗證 Cloudflare Turnstile Token
   * @param token 用戶端產生的 turnstile token (cf-turnstile-response)
   * @param remoteIp 客戶端 IP 位址 (選填)
   */
  async verify(token?: string, remoteIp?: string): Promise<TurnstileVerificationResult> {
    // 1. 若環境未啟用或未配置 Secret Key，自動旁路放行以防系統被鎖死
    if (!this.isConfigured()) {
      return { success: true };
    }

    const secretKey = this.configService.get<string>('TURNSTILE_SECRET_KEY')!;

    // 2. 檢查 Token 是否存在
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
