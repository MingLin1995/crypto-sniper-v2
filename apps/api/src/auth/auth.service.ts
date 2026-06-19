import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import ms = require('ms');
import { JWT_CONFIG } from '../common/config/jwt.config';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthenticatedUser, LoginResponse, RequestUser } from './interfaces/auth.interface';
import { EmailService } from '../common/email/email.service';
import { VerificationCodeService } from './verification-code.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly verificationCodeService: VerificationCodeService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user || !user.password) {
      throw new UnauthorizedException('電子信箱或密碼錯誤');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('電子信箱或密碼錯誤');
    }

    return this.usersService.findOne(user.id);
  }

  async login(user: AuthenticatedUser): Promise<LoginResponse> {
    const tokens = await this.generateTokens(user.id, user.email || null, user.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email || null,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    await this.verificationCodeService.verifyCode(
      'email_verify',
      registerDto.email,
      registerDto.code,
    );

    const user = await this.usersService.create({
      email: registerDto.email,
      password: registerDto.password,
      nickname: registerDto.nickname,
    });

    return this.login(user);
  }

  async logout(user: RequestUser) {
    if (user.tokenId) {
      await this.usersService.deleteRefreshToken(user.tokenId);
    } else {
      await this.usersService.deleteUserRefreshTokens(user.sub);
    }
  }

  async refreshTokens(userId: string, rt: string): Promise<LoginResponse> {
    try {
      const decoded = (await this.jwtService.verifyAsync(rt, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          JWT_CONFIG.REFRESH_SECRET_FALLBACK,
      })) as any;
      const tokenId = decoded?.tokenId;

      if (!tokenId) throw new ForbiddenException('Invalid Token Structure');

      const tokenRecord = await this.usersService.findRefreshTokenById(tokenId);
      if (!tokenRecord) throw new ForbiddenException('Access Denied');

      await this.usersService.findOne(userId);

      const rtMatches = await bcrypt.compare(rt, tokenRecord.token);
      if (!rtMatches) throw new ForbiddenException('Access Denied');

      await this.usersService.deleteRefreshToken(tokenId);

      const tokens = await this.generateTokens(userId, decoded.email || null, decoded.role);

      const user = await this.usersService.findOne(userId);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: userId,
          email: decoded.email || null,
          nickname: user.nickname,
          role: decoded.role,
        },
      };
    } catch (error) {
      throw new ForbiddenException('Access Denied');
    }
  }

  async generateTokens(userId: string, email: string | null, role: string) {
    const tokenId = crypto.randomUUID();

    const payload = {
      sub: userId,
      email,
      role,
      tokenId,
    };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET') || JWT_CONFIG.SECRET_FALLBACK,
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '30m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          JWT_CONFIG.REFRESH_SECRET_FALLBACK,
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as any,
      }),
    ]);

    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const parsedMs = ms(refreshExpiresIn as any);
    const expiresMs = typeof parsedMs === 'number' ? parsedMs : 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresMs);

    const hash = await bcrypt.hash(rt, 10);
    await this.usersService.createRefreshToken(userId, hash, expiresAt, tokenId);

    return {
      accessToken: at,
      refreshToken: rt,
    };
  }

  async sendPasswordResetEmail(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return { message: '重設驗證碼已成功寄出' };
    }

    const code = await this.verificationCodeService.generateCode('password_reset', email);

    const subject = 'CryptoSniper - 重設密碼驗證碼 / Password Reset Code';
    const text = `您的密碼重設驗證碼是：${code}，有效時間為 10 分鐘。請於密碼重設畫面輸入此驗證碼變更密碼。\nYour password reset code is: ${code}. It is valid for 10 minutes. Please enter this code on the password reset page to change your password.`;
    const html = `<div style="font-family: sans-serif; padding: 20px; color: #1e1b4b; background-color: #fafafa; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7;">
      <h2 style="color: #6366f1; margin-bottom: 20px;">CryptoSniper 重設密碼 / Password Reset</h2>
      <p style="margin-bottom: 5px; font-weight: 500;">您好，您申請了重設 CryptoSniper 帳戶的密碼。請在密碼重設頁面中填入以下 6 位數驗證碼：</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 0; margin-bottom: 20px;">*Hello! You requested to reset your password. Please enter the following 6-digit verification code on the password reset page to complete your request:*</p>
      <div style="font-size: 32px; font-weight: bold; background-color: #f3f4f6; color: #4f46e5; padding: 15px; border-radius: 6px; text-align: center; letter-spacing: 5px; margin: 25px 0;">
        ${code}
      </div>
      <p style="color: #71717a; font-size: 13px; margin-bottom: 5px;">該驗證碼有效期限為 10 分鐘。如果您並未申請重設密碼，請忽略本郵件，您的密碼將保持不變。</p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 0;">*This verification code is valid for 10 minutes. If you did not request a password reset, please ignore this email; your password will remain unchanged.*</p>
    </div>`;

    await this.emailService.send(email, subject, text, html);

    return { message: '重設驗證碼已成功寄出' };
  }

  async resetPassword(
    email: string,
    code: string,
    passwordInput: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('使用者不存在');
    }

    await this.verificationCodeService.verifyCode('password_reset', email, code);

    await this.usersService.update(user.id, { password: passwordInput });

    return { message: '密碼已成功重設' };
  }
}
