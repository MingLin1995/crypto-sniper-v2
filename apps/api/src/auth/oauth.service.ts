import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE_OPTIONS, REFRESH_TOKEN_COOKIE_OPTIONS } from '../common/config/cookie.config';
import { JwtService } from '@nestjs/jwt';
import { JWT_CONFIG } from '../common/config/jwt.config';
import { OAuthUserProfile, GoogleUserProfile, DiscordUserProfile, TelegramUserProfile } from './interfaces/oauth.interface';
import { TelegramWidgetLoginDto } from './dto/oauth.dto';
import { Request, Response } from 'express';
import { AuthenticatedUser, RequestUser } from './interfaces/auth.interface';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: ExtendedPrismaService,
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  getUserIdFromRequest(req: Request & { user?: RequestUser; cookies?: Record<string, string> }): string | null {
    if (req.user?.sub) {
      return req.user.sub;
    }
    const token = req.cookies?.access_token;
    if (token) {
      try {
        const decoded = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET') || JWT_CONFIG.SECRET_FALLBACK,
        });
        return decoded?.sub || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  getAllowedOrigins(): string[] {
    const appDomain = this.configService.get<string>('APP_DOMAIN');
    const defaultFrontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      (appDomain ? `https://${appDomain}` : 'http://localhost:3001');
    const allowed = new Set<string>();
    try {
      allowed.add(new URL(defaultFrontendUrl).origin);
    } catch {}
    if (appDomain) {
      try {
        allowed.add(new URL(`https://${appDomain}`).origin);
      } catch {}
    }

    const corsOrigins = this.configService.get<string>('CORS_ORIGINS');
    if (corsOrigins) {
      corsOrigins.split(',').forEach((origin) => {
        const trimmed = origin.trim();
        if (trimmed && trimmed !== '*') {
          try {
            allowed.add(new URL(trimmed).origin);
          } catch {}
        }
      });
    }

    return Array.from(allowed);
  }

  resolveSafeOrigin(referer?: string): string {
    const appDomain = this.configService.get<string>('APP_DOMAIN');
    const defaultFrontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      (appDomain ? `https://${appDomain}` : 'http://localhost:3001');
    if (!referer) return defaultFrontendUrl;
    try {
      const refUrl = new URL(referer);
      const refOrigin = `${refUrl.protocol}//${refUrl.host}`;
      const allowedOrigins = this.getAllowedOrigins();
      if (allowedOrigins.includes(refOrigin)) {
        return refOrigin;
      }
    } catch {
      // ignore
    }
    return defaultFrontendUrl;
  }

  async handleOAuthLoginOrLink(
    provider: 'google' | 'discord' | 'telegram',
    profile: OAuthUserProfile,
    stateUserId?: string,
  ): Promise<AuthenticatedUser> {
    const providerIdField =
      provider === 'google' ? 'googleId' : provider === 'discord' ? 'discordId' : 'telegramId';
    
    let providerId: string;
    if (provider === 'google') {
      providerId = (profile as GoogleUserProfile).sub;
    } else if (provider === 'discord') {
      providerId = (profile as DiscordUserProfile).id;
    } else {
      providerId = String((profile as TelegramUserProfile).id);
    }

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
        const rebindToken = crypto.randomUUID();
        const redisKey = `oauth_rebind:${rebindToken}`;
        await this.redisService.getClient().set(
          redisKey,
          JSON.stringify({
            userId: stateUserId,
            provider,
            providerId,
            existingUserId: existingBound.id,
          }),
          'EX',
          300,
        );
        throw new ConflictException({
          message: '此社交帳號已被其他用戶綁定',
          rebindToken,
        });
      }

      return this.prisma.client.user.update({
        where: { id: stateUserId },
        data: {
          [providerIdField]: providerId,
        },
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
          omit: { password: false },
        });

        if (user) {
          if (user.password) {
            throw new ConflictException(
              '該電子信箱已註冊。請先以信箱密碼登入，並至「帳號設定中心」進行第三方綁定。',
            );
          }

          return this.prisma.client.user.update({
            where: { id: user.id },
            data: {
              [providerIdField]: providerId,
            },
          });
        }
      }

      // 3. 若皆無，註冊全新用戶
      const name =
        (profile as any).name ||
        (profile as any).username ||
        (profile as any).first_name ||
        'Social User';

      return this.prisma.client.user.create({
        data: {
          nickname: name,
          email: profile.email || null,
          [providerIdField]: providerId,
          role: 'USER',
        },
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
      omit: { password: false },
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
      });
    } else if (provider === 'discord') {
      return this.prisma.client.user.update({
        where: { id: userId },
        data: { discordId: null },
      });
    } else {
      return this.prisma.client.user.update({
        where: { id: userId },
        data: { telegramId: null, telegramChatId: null },
      });
    }
  }

  async handleCallbackAndRedirect(
    provider: 'google' | 'discord',
    code: string,
    state: string,
    req: Request,
    res: Response,
  ) {
    const appDomain = this.configService.get<string>('APP_DOMAIN');
    const defaultFrontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      (appDomain ? `https://${appDomain}` : 'http://localhost:3001');
    let frontendUrl = defaultFrontendUrl;

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/profile?status=error&message=${encodeURIComponent('缺少 code 或 state 參數')}`);
    }

    const redis = this.redisService.getClient();
    const stateDataStr = await redis.get(`oauth_state:${state}`);

    if (!stateDataStr) {
      return res.redirect(`${defaultFrontendUrl}/profile?status=error&message=${encodeURIComponent('驗證時效已過期或無效的 state')}`);
    }

    const stateData = JSON.parse(stateDataStr);
    frontendUrl = this.resolveSafeOrigin(stateData?.origin);
    await redis.del(`oauth_state:${state}`);

    try {
      let profile: GoogleUserProfile | DiscordUserProfile;
      const apiDomain = this.configService.get<string>('API_DOMAIN');
      if (provider === 'google') {
        const googleCallbackUrl =
          this.configService.get<string>('GOOGLE_CALLBACK_URL') ||
          (apiDomain ? `https://${apiDomain}/api/auth/google/callback` : 'http://localhost:3000/api/auth/google/callback');

        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
          client_id: this.configService.get<string>('GOOGLE_CLIENT_ID'),
          client_secret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
          code,
          grant_type: 'authorization_code',
          redirect_uri: googleCallbackUrl,
        });

        const accessToken = tokenResponse.data.access_token;
        const userinfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        profile = userinfoResponse.data as GoogleUserProfile;
      } else {
        const discordCallbackUrl =
          this.configService.get<string>('DISCORD_CALLBACK_URL') ||
          (apiDomain ? `https://${apiDomain}/api/auth/discord/callback` : 'http://localhost:3000/api/auth/discord/callback');

        const params = new URLSearchParams();
        params.append('client_id', this.configService.get<string>('DISCORD_CLIENT_ID') || '');
        params.append('client_secret', this.configService.get<string>('DISCORD_CLIENT_SECRET') || '');
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', discordCallbackUrl);

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        profile = userResponse.data as DiscordUserProfile;
      }

      const user = await this.handleOAuthLoginOrLink(provider, profile, stateData.userId);
      const ip = req.ip;
      const userAgent = (req.headers['user-agent'] as string) || 'Unknown';
      const loginRes = await this.authService.login(user, ip, userAgent);

      const isProd = this.configService.get<string>('NODE_ENV') === 'production';
      res.cookie('access_token', loginRes.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS(isProd));
      res.cookie('refresh_token', loginRes.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS(isProd));

      const redirectPath = stateData.action === 'link' ? `/profile?status=success&provider=${provider}` : '/';
      res.redirect(`${frontendUrl}${redirectPath}`);
    } catch (error: any) {
      let errMsg = '內部伺服器錯誤';
      let rebindToken: string | undefined = undefined;

      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null) {
          errMsg = (response as any).message || error.message;
          rebindToken = (response as any).rebindToken;
        } else {
          errMsg = error.message;
        }
      } else {
        this.logger.error(`OAuth callback failed for ${provider}:`, error.stack || error.message || error);
      }

      const isLinkAction = stateData?.action === 'link';
      if (isLinkAction && rebindToken) {
        return res.redirect(
          `${frontendUrl}/profile?status=confirm_rebind&provider=${provider}&rebindToken=${rebindToken}`,
        );
      }

      const redirectPath = isLinkAction ? '/profile' : '/login';
      res.redirect(`${frontendUrl}${redirectPath}?status=error&message=${encodeURIComponent(errMsg)}`);
    }
  }

  async rebindProvider(userId: string, rebindToken: string) {
    const redis = this.redisService.getClient();
    const redisKey = `oauth_rebind:${rebindToken}`;
    const dataStr = await redis.get(redisKey);

    if (!dataStr) {
      throw new BadRequestException('無效或已過期的驗證憑證，請重新嘗試綁定');
    }

    const data = JSON.parse(dataStr);
    if (data.userId !== userId) {
      throw new BadRequestException('不合法的綁定請求');
    }

    const { provider, providerId, existingUserId } = data;
    const providerIdField =
      provider === 'google' ? 'googleId' : provider === 'discord' ? 'discordId' : 'telegramId';

    // 將所有資料庫寫入操作包裝在一個事務 ($transaction) 中確保原子性
    await this.prisma.client.$transaction(async (tx) => {
      // 取得被合併的臨時帳戶與目前活躍帳戶資料
      const existingUser = await tx.user.findUnique({
        where: { id: existingUserId },
      });
      if (!existingUser) {
        throw new BadRequestException('找不到被合併的用戶帳號');
      }

      const currentUser = await tx.user.findUnique({
        where: { id: userId },
      });

      // 1. 轉移/合併關聯資料 (Watchlist, SavedStrategy)
      // 轉移 Watchlist
      const existingWatchlists = await tx.watchlistItem.findMany({
        where: { userId: existingUserId },
      });
      for (const item of existingWatchlists) {
        const alreadyHas = await tx.watchlistItem.findFirst({
          where: { userId, symbol: item.symbol },
        });
        if (!alreadyHas) {
          await tx.watchlistItem.update({
            where: { id: item.id },
            data: { userId },
          });
        } else {
          await tx.watchlistItem.delete({
            where: { id: item.id },
          });
        }
      }

      // 轉移 SavedStrategy
      const existingStrategies = await tx.savedStrategy.findMany({
        where: { userId: existingUserId },
      });
      for (const strategy of existingStrategies) {
        if (strategy.name === '__categories__') {
          const mainCategoriesStrat = await tx.savedStrategy.findFirst({
            where: { userId, name: '__categories__' },
          });
          const targetCats = (strategy.config as any)?.categories || [];
          if (mainCategoriesStrat) {
            const mainCats = (mainCategoriesStrat.config as any)?.categories || [];
            const mergedCats = Array.from(new Set([...mainCats, ...targetCats]));
            await tx.savedStrategy.update({
              where: { id: mainCategoriesStrat.id },
              data: {
                config: {
                  ...(mainCategoriesStrat.config as any),
                  categories: mergedCats,
                },
              },
            });
            // 刪除臨時用戶的分類設定
            await tx.savedStrategy.delete({
              where: { id: strategy.id },
            });
          } else {
            // 主要帳戶沒有自訂分類，直接將其轉移
            await tx.savedStrategy.update({
              where: { id: strategy.id },
              data: { userId },
            });
          }
          continue;
        }

        const alreadyHas = await tx.savedStrategy.findFirst({
          where: { userId, name: strategy.name },
        });
        if (!alreadyHas) {
          await tx.savedStrategy.update({
            where: { id: strategy.id },
            data: { userId },
          });
        } else {
          // 尋找下一個可用的序號 (e.g., 策略名稱(1), 策略名稱(2))
          let suffixNum = 1;
          let mergedName = `${strategy.name}(${suffixNum})`;
          let nameConflict = await tx.savedStrategy.findFirst({
            where: { userId, name: mergedName },
          });
          
          while (nameConflict) {
            suffixNum++;
            mergedName = `${strategy.name}(${suffixNum})`;
            nameConflict = await tx.savedStrategy.findFirst({
              where: { userId, name: mergedName },
            });
          }

          await tx.savedStrategy.update({
            where: { id: strategy.id },
            data: { userId, name: mergedName },
          });
        }
      }

      // 2. 撤銷被合併用戶的所有 Refresh Token
      await tx.refreshToken.deleteMany({
        where: { userId: existingUserId },
      });

      // 3. 軟刪除被合併用戶，並將其社交 ID 欄位清空為 null 以利重複使用
      await tx.user.update({
        where: { id: existingUserId },
        data: {
          deletedAt: new Date(),
          email: null,
          googleId: null,
          discordId: null,
          telegramId: null,
          telegramChatId: null,
        },
      });

      // 4. 綁定新社交 ID 到當前主要帳號
      await tx.user.update({
        where: { id: userId },
        data: {
          [providerIdField]: providerId,
          ...(provider === 'telegram' && {
            telegramChatId: currentUser?.telegramChatId || existingUser?.telegramChatId || null,
          }),
        },
      });
    });

    // 5. 刪除 Redis Token
    await redis.del(redisKey);

    return { message: '社交帳號綁定與合併成功' };
  }
}
