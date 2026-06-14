import { Controller, Post, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OAuthService } from './oauth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AccountLinkController {
  constructor(private readonly oauthService: OAuthService) {}

  @Post('google/unlink')
  @ApiBearerAuth()
  @ApiOperation({ summary: '解除 Google 綁定' })
  async unlinkGoogle(@Request() req: any) {
    await this.oauthService.unlinkProvider(req.user.sub, 'google');
    return { message: 'Google 帳號解綁成功' };
  }

  @Post('discord/unlink')
  @ApiBearerAuth()
  @ApiOperation({ summary: '解除 Discord 綁定' })
  async unlinkDiscord(@Request() req: any) {
    await this.oauthService.unlinkProvider(req.user.sub, 'discord');
    return { message: 'Discord 帳號解綁成功' };
  }

  @Post('telegram/unlink')
  @ApiBearerAuth()
  @ApiOperation({ summary: '解除 Telegram 綁定' })
  async unlinkTelegram(@Request() req: any) {
    await this.oauthService.unlinkProvider(req.user.sub, 'telegram');
    return { message: 'Telegram 帳號解綁成功' };
  }
}
