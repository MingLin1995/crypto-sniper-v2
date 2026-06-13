import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ApiOkResponseGeneric, ApiCreatedResponseGeneric } from '../common/decorators/api-ok-response-generic.decorator';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { RefreshTokenGuard } from './refresh-token.guard';
import { LoginDto, RegisterDto, AuthResponseDto, LogoutResponseDto } from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: '註冊' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponseGeneric(AuthResponseDto)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: '登入' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponseGeneric(AuthResponseDto)
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto);
    return this.authService.login(user);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: '登出' })
  @ApiOkResponseGeneric(LogoutResponseDto)
  async logout(@Request() req: any) {
    await this.authService.logout(req.user);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @ApiOperation({ summary: '刷新 Token' })
  @ApiOkResponseGeneric(AuthResponseDto)
  async refreshTokens(@Request() req: any) {
    const userId = req.user['sub'];
    const refreshToken = req.user['refreshToken'];
    return this.authService.refreshTokens(userId, refreshToken);
  }
}
