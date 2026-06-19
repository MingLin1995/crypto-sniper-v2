import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { randomInt } from 'crypto';

export type VerificationAction = 'email_verify' | 'password_reset';

@Injectable()
export class VerificationCodeService {
  constructor(private readonly redisService: RedisService) {}

  private getCodeKey(action: VerificationAction, email: string): string {
    return `verify_code:${action}:${email}`;
  }

  private getAttemptsKey(action: VerificationAction, email: string): string {
    return `verify_attempts:${action}:${email}`;
  }

  /**
   * 產生並將驗證碼儲存至 Redis，效期預設 10 分鐘 (600 秒)
   */
  async generateCode(action: VerificationAction, email: string, ttlSeconds = 600): Promise<string> {
    const redis = this.redisService.getClient();
    const codeKey = this.getCodeKey(action, email);
    const attemptsKey = this.getAttemptsKey(action, email);

    // 使用 CSPRNG 產生密碼學安全的 6 位數字驗證碼 (100000 - 999999)
    const code = randomInt(100000, 1000000).toString();

    // 寫入 Redis
    await redis.set(codeKey, code, 'EX', ttlSeconds);
    // 重設該信箱與該動作的錯誤嘗試次數
    await redis.del(attemptsKey);

    return code;
  }

  /**
   * 驗證驗證碼是否正確 (含錯誤次數限制，防暴力破解)
   */
  async verifyCode(action: VerificationAction, email: string, inputCode: string, maxAttempts = 5): Promise<void> {
    const redis = this.redisService.getClient();
    const codeKey = this.getCodeKey(action, email);
    const attemptsKey = this.getAttemptsKey(action, email);

    const cachedCode = await redis.get(codeKey);
    if (!cachedCode) {
      throw new BadRequestException('驗證碼無效或已過期');
    }

    // 檢查嘗試次數是否已超限
    const attemptsStr = await redis.get(attemptsKey);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    if (attempts >= maxAttempts) {
      // 超限時立即作廢驗證碼
      await redis.del(codeKey);
      await redis.del(attemptsKey);
      throw new BadRequestException('嘗試次數過多，驗證碼已失效，請重新申請');
    }

    if (cachedCode !== inputCode) {
      const newAttempts = attempts + 1;
      if (newAttempts >= maxAttempts) {
        // 達到最大重試次數，將驗證碼與次數清除
        await redis.del(codeKey);
        await redis.del(attemptsKey);
        throw new BadRequestException('驗證碼輸入錯誤次數過多，已自動失效，請重新申請');
      } else {
        // 更新嘗試次數，維持原驗證碼的過期時間或新設一個 10 分鐘的過期時間
        await redis.set(attemptsKey, newAttempts.toString(), 'EX', 600);
        throw new BadRequestException(`驗證碼錯誤，剩餘嘗試次數：${maxAttempts - newAttempts} 次`);
      }
    }

    // 驗證成功，清除驗證碼與嘗試次數
    await redis.del(codeKey);
    await redis.del(attemptsKey);
  }
}
