import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Res,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ApiOkResponseGeneric, ApiCreatedResponseGeneric } from '../common/decorators/api-ok-response-generic.decorator';
import { AuthService } from './auth.service';
import { TelegramBotService } from './telegram-bot.service';
import { RedisService } from '../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../common/decorators/public.decorator';
import { RefreshTokenGuard } from './refresh-token.guard';
import { LoginDto, RegisterDto, AuthResponseDto, LogoutResponseDto } from './dto/auth.dto';
import { TelegramWidgetLoginDto } from './dto/oauth.dto';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import * as crypto from 'crypto';
import axios from 'axios';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly telegramBotService: TelegramBotService,
  ) { }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000, // 30 分鐘
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  private getUserIdFromRequest(req: any): string | null {
    if (req.user?.sub) {
      return req.user.sub;
    }
    const token = req.cookies?.access_token;
    if (token) {
      try {
        const decoded = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
        });
        return decoded?.sub || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: '註冊' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponseGeneric(AuthResponseDto)
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(registerDto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: '登入' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponseGeneric(AuthResponseDto)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(loginDto);
    const result = await this.authService.login(user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: '登出' })
  @ApiOkResponseGeneric(LogoutResponseDto)
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user);
    this.clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @ApiOperation({ summary: '刷新 Token' })
  @ApiOkResponseGeneric(AuthResponseDto)
  async refreshTokens(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const userId = req.user['sub'];
    const refreshToken = req.user['refreshToken'];
    const result = await this.authService.refreshTokens(userId, refreshToken);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  // ========== Google OAuth Endpoints ==========

  @Public()
  @Get('google')
  @ApiOperation({ summary: '重導向至 Google 登入/綁定頁面' })
  async googleLogin(
    @Query('action') action: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const state = crypto.randomUUID();
    const stateData: any = { action };

    if (action === 'link') {
      const userId = this.getUserIdFromRequest(req);
      if (!userId) {
        throw new UnauthorizedException('請先登入以進行帳號綁定');
      }
      stateData.userId = userId;
    }

    await this.redisService.getClient().set(`oauth_state:${state}`, JSON.stringify(stateData), 'EX', 300);

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL');
    const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      callbackUrl || '',
    )}&response_type=code&scope=openid%20profile%20email&state=${state}&prompt=select_account`;

    res.redirect(redirectUrl);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth 回呼' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    
    if (!code || !state) {
      return res.redirect(`${frontendUrl}/profile?status=error&message=${encodeURIComponent('缺少 code 或 state 參數')}`);
    }

    const redis = this.redisService.getClient();
    const stateDataStr = await redis.get(`oauth_state:${state}`);
    if (!stateDataStr) {
      return res.redirect(`${frontendUrl}/profile?status=error&message=${encodeURIComponent('驗證時效已過期')}`);
    }

    const stateData = JSON.parse(stateDataStr);
    await redis.del(`oauth_state:${state}`);

    try {
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: this.configService.get<string>('GOOGLE_CLIENT_ID'),
        client_secret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.configService.get<string>('GOOGLE_CALLBACK_URL'),
      });

      const accessToken = tokenResponse.data.access_token;

      const userinfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = userinfoResponse.data;
      const user = await this.authService.handleOAuthLoginOrLink('google', profile, stateData.userId);

      const loginRes = await this.authService.login(user);
      this.setAuthCookies(res, loginRes.accessToken, loginRes.refreshToken);

      const redirectPath = stateData.action === 'link' ? '/profile?status=success&provider=google' : '/';
      res.redirect(`${frontendUrl}${redirectPath}`);
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || '內部伺服器錯誤';
      res.redirect(`${frontendUrl}/profile?status=error&message=${encodeURIComponent(errMsg)}`);
    }
  }

  // ========== Discord OAuth Endpoints ==========

  @Public()
  @Get('discord')
  @ApiOperation({ summary: '重導向至 Discord 登入/綁定頁面' })
  async discordLogin(
    @Query('action') action: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const state = crypto.randomUUID();
    const stateData: any = { action };

    if (action === 'link') {
      const userId = this.getUserIdFromRequest(req);
      if (!userId) {
        throw new UnauthorizedException('請先登入以進行帳號綁定');
      }
      stateData.userId = userId;
    }

    await this.redisService.getClient().set(`oauth_state:${state}`, JSON.stringify(stateData), 'EX', 300);

    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');
    const callbackUrl = this.configService.get<string>('DISCORD_CALLBACK_URL');
    const redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      callbackUrl || '',
    )}&response_type=code&scope=identify%20email&state=${state}`;

    res.redirect(redirectUrl);
  }

  @Public()
  @Get('discord/callback')
  @ApiOperation({ summary: 'Discord OAuth 回呼' })
  async discordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/profile?status=error&message=${encodeURIComponent('缺少 code 或 state 參數')}`);
    }

    const redis = this.redisService.getClient();
    const stateDataStr = await redis.get(`oauth_state:${state}`);
    if (!stateDataStr) {
      return res.redirect(`${frontendUrl}/profile?status=error&message=${encodeURIComponent('驗證時效已過期')}`);
    }

    const stateData = JSON.parse(stateDataStr);
    await redis.del(`oauth_state:${state}`);

    try {
      const params = new URLSearchParams();
      params.append('client_id', this.configService.get<string>('DISCORD_CLIENT_ID') || '');
      params.append('client_secret', this.configService.get<string>('DISCORD_CLIENT_SECRET') || '');
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', this.configService.get<string>('DISCORD_CALLBACK_URL') || '');

      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const accessToken = tokenResponse.data.access_token;

      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const profile = userResponse.data;
      const user = await this.authService.handleOAuthLoginOrLink('discord', profile, stateData.userId);

      const loginRes = await this.authService.login(user);
      this.setAuthCookies(res, loginRes.accessToken, loginRes.refreshToken);

      const redirectPath = stateData.action === 'link' ? '/profile?status=success&provider=discord' : '/';
      res.redirect(`${frontendUrl}${redirectPath}`);
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || '內部伺服器錯誤';
      res.redirect(`${frontendUrl}/profile?status=error&message=${encodeURIComponent(errMsg)}`);
    }
  }

  // ========== Telegram Endpoints ==========

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
  async telegramLogin(@Body() dto: TelegramWidgetLoginDto, @Res({ passthrough: true }) res: Response) {
    this.authService.validateTelegramAuth(dto);
    
    const user = await this.authService.handleOAuthLoginOrLink('telegram', {
      id: dto.id,
      first_name: dto.first_name,
    });

    const result = await this.authService.login(user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Post('telegram/link')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Telegram Widget 綁定' })
  async telegramLink(@Request() req: any, @Body() dto: TelegramWidgetLoginDto) {
    this.authService.validateTelegramAuth(dto);
    
    await this.authService.handleOAuthLoginOrLink('telegram', {
      id: dto.id,
      first_name: dto.first_name,
    }, req.user.sub);

    return { message: 'Telegram 帳號綁定成功' };
  }

  @Public()
  @Post('telegram/webhook')
  @ApiOperation({ summary: '接收 Telegram Webhook 更新訊息' })
  async telegramWebhook(@Body() update: any) {
    await this.telegramBotService.handleWebhookUpdate(update);
    return { status: 'ok' };
  }

  // ========== Safe Unlink Endpoints ==========

  @Post('google/unlink')
  @ApiBearerAuth()
  @ApiOperation({ summary: '解除 Google 綁定' })
  async unlinkGoogle(@Request() req: any) {
    await this.authService.unlinkProvider(req.user.sub, 'google');
    return { message: 'Google 帳號解綁成功' };
  }

  @Post('discord/unlink')
  @ApiBearerAuth()
  @ApiOperation({ summary: '解除 Discord 綁定' })
  async unlinkDiscord(@Request() req: any) {
    await this.authService.unlinkProvider(req.user.sub, 'discord');
    return { message: 'Discord 帳號解綁成功' };
  }

  @Post('telegram/unlink')
  @ApiBearerAuth()
  @ApiOperation({ summary: '解除 Telegram 綁定' })
  async unlinkTelegram(@Request() req: any) {
    await this.authService.unlinkProvider(req.user.sub, 'telegram');
    return { message: 'Telegram 帳號解綁成功' };
  }
}
