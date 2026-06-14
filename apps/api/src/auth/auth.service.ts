import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { RedisService } from '../common/redis/redis.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import ms = require('ms');
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { TelegramWidgetLoginDto } from './dto/oauth.dto';
import { AuthenticatedUser, LoginResponse, RequestUser } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: ExtendedPrismaService,
    private redisService: RedisService,
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

    // 發送驗證信
    const smtpHost = this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = Number(this.configService.get<number>('SMTP_PORT')) || 465;
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!smtpUser || !smtpPass) {
      throw new InternalServerErrorException('SMTP 伺服器憑證未正確設定，無法發送驗證信');
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    try {
      await transporter.sendMail({
        from: `"CryptoSniper" <${smtpUser}>`,
        to: email,
        subject: 'CryptoSniper - 註冊電子信箱驗證碼 / Verification Code',
        text: `您的驗證碼是：${code}，有效時間為 10 分鐘。請於註冊畫面輸入此驗證碼完成信箱驗證。\nYour verification code is: ${code}. It is valid for 10 minutes. Please enter this code on the registration page to verify your email.`,
        html: `<div style="font-family: sans-serif; padding: 20px; color: #1e1b4b; background-color: #fafafa; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7;">
          <h2 style="color: #6366f1; margin-bottom: 20px;">CryptoSniper 電子信箱驗證 / Email Verification</h2>
          <p style="margin-bottom: 5px; font-weight: 500;">您好，感謝您註冊 CryptoSniper。請在註冊頁面中填入以下 6 位數驗證碼以完成信箱驗證：</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 0; margin-bottom: 20px;">*Hello! Thank you for registering with CryptoSniper. Please enter the following 6-digit verification code on the registration page to complete your email verification:*</p>
          <div style="font-size: 32px; font-weight: bold; background-color: #f3f4f6; color: #4f46e5; padding: 15px; border-radius: 6px; text-align: center; letter-spacing: 5px; margin: 25px 0;">
            ${code}
          </div>
          <p style="color: #71717a; font-size: 13px; margin-bottom: 5px;">該驗證碼有效期限為 10 分鐘。如果您並未申請此驗證信，請忽略本郵件。</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 0;">*This verification code is valid for 10 minutes. If you did not request this email, please ignore it.*</p>
        </div>`,
      });

      return { message: '驗證碼已成功寄出' };
    } catch (error) {
      throw new InternalServerErrorException('驗證信寄送失敗，請稍後重試');
    }
  }

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    const redis = this.redisService.getClient();
    const cachedCode = await redis.get(`email_verify:${registerDto.email}`);

    if (!cachedCode || cachedCode !== registerDto.code) {
      throw new BadRequestException('驗證碼無效或已過期');
    }

    // 驗證成功，清除快取
    await redis.del(`email_verify:${registerDto.email}`);

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
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key',
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
        secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '30m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key',
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

  async handleOAuthLoginOrLink(
    provider: 'google' | 'discord' | 'telegram',
    profile: any,
    stateUserId?: string,
  ): Promise<any> {
    const providerIdField =
      provider === 'google' ? 'googleId' : provider === 'discord' ? 'discordId' : 'telegramId';
    const providerId =
      provider === 'google'
        ? profile.sub
        : provider === 'discord'
          ? profile.id
          : String(profile.id);

    if (!providerId) {
      throw new BadRequestException('無法從社交平台取得用戶識別 ID');
    }

    if (stateUserId) {
      const user = await this.prisma.client.user.findUnique({
        where: { id: stateUserId },
      });
      if (!user) {
        throw new NotFoundException('用戶不存在');
      }

      const existingBound = await this.prisma.client.user.findFirst({
        where: {
          [providerIdField]: providerId,
          id: { not: stateUserId },
        },
      });
      if (existingBound) {
        throw new ConflictException('此社交帳號已被其他用戶綁定');
      }

      return this.prisma.client.user.update({
        where: { id: stateUserId },
        data: {
          [providerIdField]: providerId,
          ...(provider === 'telegram' && { telegramChatId: providerId }),
        },
        omit: { password: true },
      });
    } else {
      // 1. 尋找是否已有綁定此社交 ID 的用戶
      let user = await this.prisma.client.user.findFirst({
        where: { [providerIdField]: providerId },
      });

      if (user) {
        return user;
      }

      // 2. 尋找是否有相同 Email 的用戶
      if (profile.email) {
        user = await this.prisma.client.user.findUnique({
          where: { email: profile.email },
        });

        if (user) {
          return this.prisma.client.user.update({
            where: { id: user.id },
            data: {
              [providerIdField]: providerId,
              ...(provider === 'telegram' && { telegramChatId: providerId }),
            },
            omit: { password: true },
          });
        }
      }

      // 3. 若皆無，註冊全新用戶
      const name = profile.name || profile.username || profile.first_name || 'Social User';

      return this.prisma.client.user.create({
        data: {
          nickname: name,
          email: profile.email || null,
          [providerIdField]: providerId,
          role: 'USER',
          ...(provider === 'telegram' && { telegramChatId: providerId }),
        },
        omit: { password: true },
      });
    }
  }

  validateTelegramAuth(data: TelegramWidgetLoginDto): boolean {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new InternalServerErrorException('Telegram Bot Token 未設定');
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - data.auth_date > 86400 || data.auth_date > now + 300) {
      throw new UnauthorizedException('驗證時效已過期');
    }

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const checkParams = Object.keys(data)
      .filter(
        (key) =>
          key !== 'hash' &&
          data[key as keyof TelegramWidgetLoginDto] !== undefined &&
          data[key as keyof TelegramWidgetLoginDto] !== null,
      )
      .sort()
      .map((key) => `${key}=${data[key as keyof TelegramWidgetLoginDto]}`)
      .join('\n');

    const hmac = crypto.createHmac('sha256', secretKey).update(checkParams).digest('hex');

    if (hmac !== data.hash) {
      throw new UnauthorizedException('Telegram 雜湊驗證失敗');
    }

    return true;
  }

  async unlinkProvider(userId: string, provider: 'google' | 'discord' | 'telegram') {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用戶不存在');
    }

    let activeMethods = 0;
    if (user.password) activeMethods++;
    if (user.googleId) activeMethods++;
    if (user.discordId) activeMethods++;
    if (user.telegramId) activeMethods++;

    const isCurrentLinked =
      (provider === 'google' && user.googleId) ||
      (provider === 'discord' && user.discordId) ||
      (provider === 'telegram' && user.telegramId);

    if (isCurrentLinked && activeMethods <= 1) {
      throw new BadRequestException(
        '無法解除綁定，您必須保留至少一種登入方式（密碼或其他社交帳號）',
      );
    }

    if (provider === 'google') {
      return this.prisma.client.user.update({
        where: { id: userId },
        data: { googleId: null },
        omit: { password: true },
      });
    } else if (provider === 'discord') {
      return this.prisma.client.user.update({
        where: { id: userId },
        data: { discordId: null },
        omit: { password: true },
      });
    } else {
      return this.prisma.client.user.update({
        where: { id: userId },
        data: { telegramId: null, telegramChatId: null },
        omit: { password: true },
      });
    }
  }
}
