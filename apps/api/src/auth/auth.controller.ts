import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ApiOkResponseGeneric, ApiCreatedResponseGeneric } from '../common/decorators/api-ok-response-generic.decorator';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { Public } from '../common/decorators/public.decorator';
import { RefreshTokenGuard } from './refresh-token.guard';
import { TurnstileGuard } from '../common/security/turnstile/turnstile.guard';
import { TurnstileService } from '../common/security/turnstile/turnstile.service';
import { LoginDto, RegisterDto, AuthResponseDto, LogoutResponseDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { SendVerificationEmailDto } from './dto/email-verification.dto';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ACCESS_TOKEN_COOKIE_OPTIONS, REFRESH_TOKEN_COOKIE_OPTIONS } from '../common/config/cookie.config';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly configService: ConfigService,
    private readonly turnstileService: TurnstileService,
  ) { }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('access_token', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS(isProd));
    res.cookie('refresh_token', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS(isProd));
  }

  private clearAuthCookies(res: Response) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const { maxAge: _atMaxAge, ...atOptions } = ACCESS_TOKEN_COOKIE_OPTIONS(isProd);
    const { maxAge: _rtMaxAge, ...rtOptions } = REFRESH_TOKEN_COOKIE_OPTIONS(isProd);
    res.clearCookie('access_token', atOptions);
    res.clearCookie('refresh_token', rtOptions);
  }

  @Public()
  @Get('turnstile-config')
  @ApiOperation({ summary: '取得 Turnstile 配置狀態與公鑰' })
  getTurnstileConfig() {
    return {
      enabled: this.turnstileService.isConfigured(),
      siteKey: this.turnstileService.getSiteKey(),
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send-verification-email')
  @ApiOperation({ summary: '發送註冊 Email 驗證碼' })
  async sendVerificationEmail(@Body() sendEmailDto: SendVerificationEmailDto) {
    return this.emailVerificationService.sendVerificationEmail(sendEmailDto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: '註冊' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponseGeneric(AuthResponseDto)
  async register(@Request() req: any, @Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const result = await this.authService.register(registerDto, ip, userAgent);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Public()
  @UseGuards(TurnstileGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: '登入' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponseGeneric(AuthResponseDto)
  async login(@Request() req: any, @Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(loginDto);
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const result = await this.authService.login(user, ip, userAgent);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: '忘記密碼：發送密碼重設驗證碼' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.sendPasswordResetEmail(forgotPasswordDto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @ApiOperation({ summary: '重設密碼' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.code,
      resetPasswordDto.password,
    );
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
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const result = await this.authService.refreshTokens(userId, refreshToken, ip, userAgent);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }
}
