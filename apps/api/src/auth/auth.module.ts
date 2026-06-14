import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { EmailVerificationService } from './email-verification.service';
import { AuthController } from './auth.controller';
import { GoogleOAuthController } from './oauth/google-oauth.controller';
import { DiscordOAuthController } from './oauth/discord-oauth.controller';
import { TelegramController } from './oauth/telegram.controller';
import { AccountLinkController } from './account-link.controller';
import { JwtStrategy } from './jwt.strategy';
import { RefreshTokenStrategy } from './refresh-token.strategy';
import { TelegramBotService } from './telegram-bot.service';
import { UsersModule } from '../users/users.module';
import { JWT_CONFIG } from '../common/config/jwt.config';
import type { StringValue } from 'ms';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || JWT_CONFIG.SECRET_FALLBACK,
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '30m') as StringValue | number,
        },
      }),
    }),
    UsersModule,
  ],
  controllers: [
    AuthController,
    GoogleOAuthController,
    DiscordOAuthController,
    TelegramController,
    AccountLinkController,
  ],
  providers: [
    AuthService,
    OAuthService,
    EmailVerificationService,
    JwtStrategy,
    RefreshTokenStrategy,
    TelegramBotService,
  ],
  exports: [AuthService, OAuthService, TelegramBotService],
})
export class AuthModule { }
