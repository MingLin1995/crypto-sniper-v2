import { Controller, Get, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { OAuthService } from '../oauth.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { Response } from 'express';
import * as crypto from 'crypto';

@ApiTags('Authentication')
@Controller('auth')
export class DiscordOAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get('discord')
  @ApiOperation({ summary: '重導向至 Discord 登入/綁定頁面' })
  async discordLogin(
    @Query('action') action: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const state = crypto.randomUUID();
    const referer = req.headers.referer;
    let origin = '';
    if (referer) {
      try {
        const refUrl = new URL(referer);
        origin = `${refUrl.protocol}//${refUrl.host}`;
      } catch (e) {
        // ignore
      }
    }

    const stateData: any = { action };
    if (origin) {
      stateData.origin = origin;
    }

    if (action === 'link') {
      const userId = this.oauthService.getUserIdFromRequest(req);
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
  @SkipTransform()
  @ApiOperation({ summary: 'Discord OAuth 回呼' })
  async discordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    await this.oauthService.handleCallbackAndRedirect('discord', code, state, req, res);
  }
}
