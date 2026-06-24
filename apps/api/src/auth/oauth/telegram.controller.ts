import { Controller, Get, Post, Body, Res, Request, Param, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { OAuthService } from '../oauth.service';
import { TelegramBotService } from '../telegram-bot.service';
import { AuthService } from '../auth.service';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { TelegramWidgetLoginDto } from '../dto/oauth.dto';
import { Response } from 'express';
import * as crypto from 'crypto';
import { ACCESS_TOKEN_COOKIE_OPTIONS, REFRESH_TOKEN_COOKIE_OPTIONS } from '../../common/config/cookie.config';

@ApiTags('Authentication')
@Controller('auth')
export class TelegramController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly telegramBotService: TelegramBotService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  @Get('telegram/link-token')
  @ApiBearerAuth()
  @ApiOperation({ summary: '取得 Telegram 機器人綁定 token' })
  async getTelegramLinkToken(@Request() req: any) {
    const userId = req.user.sub;
    const token = crypto.randomBytes(16).toString('hex');
    
    const redis = this.redisService.getClient();
    await redis.set(`tg_link:${token}`, userId, 'EX', 600); // 10 分鐘有效

    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'CryptoSniper_MLvip_Bot';
    const botUrl = `https://t.me/${botUsername}?start=${token}`;

    return { token, botUrl };
  }

  @Public()
  @Post('telegram/login')
  @ApiOperation({ summary: 'Telegram Widget 登入' })
  async telegramLogin(
    @Request() req: any,
    @Body() dto: TelegramWidgetLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.oauthService.validateTelegramAuth(dto);
    
    const user = await this.oauthService.handleOAuthLoginOrLink('telegram', {
      id: dto.id,
      first_name: dto.first_name,
    });

    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const result = await this.authService.login(user, ip, userAgent);
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('access_token', result.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS(isProd));
    res.cookie('refresh_token', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS(isProd));
    return result;
  }

  @Post('telegram/link')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Telegram Widget 綁定' })
  async telegramLink(@Request() req: any, @Body() dto: TelegramWidgetLoginDto) {
    this.oauthService.validateTelegramAuth(dto);
    
    await this.oauthService.handleOAuthLoginOrLink('telegram', {
      id: dto.id,
      first_name: dto.first_name,
    }, req.user.sub);

    return { message: 'Telegram 帳號綁定成功' };
  }

  @Public()
  @Post('telegram/webhook/:token')
  @SkipTransform()
  @ApiOperation({ summary: '接收 Telegram Webhook 更新訊息' })
  async telegramWebhook(@Param('token') token: string, @Body() update: any) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken || token !== botToken) {
      throw new UnauthorizedException('無效的 Webhook 憑證');
    }
    await this.telegramBotService.handleWebhookUpdate(update);
    return { status: 'ok' };
  }
}
