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
export class GoogleOAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get('google')
  @ApiOperation({ summary: '重導向至 Google 登入/綁定頁面' })
  async googleLogin(
    @Query('action') action: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const state = crypto.randomUUID();
    const referer = req.headers.referer;
    const origin = this.oauthService.resolveSafeOrigin(referer);

    const stateData: any = { action, origin };

    if (action === 'link') {
      const userId = this.oauthService.getUserIdFromRequest(req);
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
  @SkipTransform()
  @ApiOperation({ summary: 'Google OAuth 回呼' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    await this.oauthService.handleCallbackAndRedirect('google', code, state, req, res);
  }
}
