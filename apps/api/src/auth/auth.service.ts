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
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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
  ) { }

  async validateUser(loginDto: LoginDto): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByAccount(loginDto.account);

    if (!user || !user.password) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    return this.usersService.findOne(user.id);
  }

  async login(user: AuthenticatedUser): Promise<LoginResponse> {
    const tokens = await this.generateTokens(user.id, user.account, user.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        account: user.account,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    const user = await this.usersService.create(registerDto);
    return this.login(user);
  }

  async logout(user: RequestUser) {
    if (user.tokenId) {
      await this.usersService.deleteRefreshToken(user.tokenId);
    } else {
      // 如果找不到 tokenId，則刪除所有 token
      await this.usersService.deleteUserRefreshTokens(user.sub);
    }
  }

  async refreshTokens(userId: string, rt: string): Promise<LoginResponse> {
    try {
      const decoded = await this.jwtService.verifyAsync(rt, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key',
      }) as any;
      const tokenId = decoded?.tokenId;

      if (!tokenId) throw new ForbiddenException('Invalid Token Structure');

      const tokenRecord = await this.usersService.findRefreshTokenById(tokenId);
      if (!tokenRecord) throw new ForbiddenException('Access Denied');

      // 檢查使用者是否仍然存在且未被軟刪除
      await this.usersService.findOne(userId);

      const rtMatches = await bcrypt.compare(rt, tokenRecord.token);
      if (!rtMatches) throw new ForbiddenException('Access Denied');

      // 刪除舊的，建立新的
      await this.usersService.deleteRefreshToken(tokenId);

      const tokens = await this.generateTokens(userId, decoded.account, decoded.role);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: userId,
          account: decoded.account,
          role: decoded.role,
        },
      };
    } catch (error) {
      throw new ForbiddenException('Access Denied');
    }
  }

  async generateTokens(userId: string, account: string, role: string) {
    const tokenId = crypto.randomUUID();

    const payload = {
      sub: userId,
      account,
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
    const providerIdField = provider === 'google' ? 'googleId' : (provider === 'discord' ? 'discordId' : 'telegramId');
    const providerId = provider === 'google' ? profile.sub : (provider === 'discord' ? profile.id : String(profile.id));

    if (!providerId) {
      throw new BadRequestException('無法從社交平台取得用戶識別 ID');
    }

    if (stateUserId) {
      // 綁定流程
      const user = await this.prisma.client.user.findUnique({
        where: { id: stateUserId },
      });
      if (!user) {
        throw new NotFoundException('用戶不存在');
      }

      // 檢查此社交帳號是否已被其他用戶綁定
      const existingBound = await this.prisma.client.user.findFirst({
        where: {
          [providerIdField]: providerId,
          id: { not: stateUserId },
        },
      });
      if (existingBound) {
        throw new ConflictException('此社交帳號已被其他用戶綁定');
      }

      // 更新綁定資訊
      return this.prisma.client.user.update({
        where: { id: stateUserId },
        data: {
          [providerIdField]: providerId,
          ...(provider === 'telegram' && { telegramChatId: providerId }),
        },
        omit: { password: true },
      });
    } else {
      // 登入/註冊流程
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
          // 關聯並綁定
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

      // 3. 若皆無，註冊一個密碼為空的全新用戶
      // 自動生成唯一的 account 名稱
      const suffix = Math.random().toString(36).substring(2, 7);
      const accountName = `${provider}_${providerId.substring(0, 10)}_${suffix}`;

      return this.prisma.client.user.create({
        data: {
          account: accountName,
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
    // 驗證時效 24 小時，並容許 5 分鐘的時鐘偏離
    if (now - data.auth_date > 86400 || data.auth_date > now + 300) {
      throw new UnauthorizedException('驗證時效已過期');
    }

    // 計算雜湊值
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const checkParams = Object.keys(data)
      .filter((key) => key !== 'hash' && data[key as keyof TelegramWidgetLoginDto] !== undefined && data[key as keyof TelegramWidgetLoginDto] !== null)
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
      throw new BadRequestException('無法解除綁定，您必須保留至少一種登入方式（密碼或其他社交帳號）');
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
