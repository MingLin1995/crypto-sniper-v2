import { Injectable, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RedisService } from '../common/redis/redis.service';
import { EmailService } from '../common/email/email.service';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async sendVerificationEmail(email: string): Promise<{ message: string }> {
    // 檢查信箱是否已使用
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email 已被使用');
    }

    // 產生 6 位數驗證碼
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存入 Redis，效期 10 分鐘 (600秒)
    const redis = this.redisService.getClient();
    await redis.set(`email_verify:${email}`, code, 'EX', 600);

    const subject = 'CryptoSniper - 註冊電子信箱驗證碼 / Verification Code';
    const text = `您的驗證碼是：${code}，有效時間為 10 分鐘。請於註冊畫面輸入此驗證碼完成信箱驗證。\nYour verification code is: ${code}. It is valid for 10 minutes. Please enter this code on the registration page to verify your email.`;
    const html = `<div style="font-family: sans-serif; padding: 20px; color: #1e1b4b; background-color: #fafafa; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7;">
      <h2 style="color: #6366f1; margin-bottom: 20px;">CryptoSniper 電子信箱驗證 / Email Verification</h2>
      <p style="margin-bottom: 5px; font-weight: 500;">您好，感謝您註冊 CryptoSniper。請在註冊頁面中填入以下 6 位數驗證碼以完成信箱驗證：</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 0; margin-bottom: 20px;">*Hello! Thank you for registering with CryptoSniper. Please enter the following 6-digit verification code on the registration page to complete your email verification:*</p>
      <div style="font-size: 32px; font-weight: bold; background-color: #f3f4f6; color: #4f46e5; padding: 15px; border-radius: 6px; text-align: center; letter-spacing: 5px; margin: 25px 0;">
        ${code}
      </div>
      <p style="color: #71717a; font-size: 13px; margin-bottom: 5px;">該驗證碼有效期限為 10 分鐘。如果您並未申請此驗證信，請忽略本郵件。</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 0;">*This verification code is valid for 10 minutes. If you did not request this email, please ignore it.*</p>
    </div>`;

    await this.emailService.send(email, subject, text, html);

    return { message: '驗證碼已成功寄出' };
  }
}
