import { Controller, Post, Body, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ApiOkResponseGeneric, ApiCreatedResponseGeneric } from '../common/decorators/api-ok-response-generic.decorator';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { RefreshTokenGuard } from './refresh-token.guard';
import { LoginDto, RegisterDto, AuthResponseDto, LogoutResponseDto } from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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
}
