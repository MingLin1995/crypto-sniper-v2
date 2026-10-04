import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppController } from './app.controller';
import { LoggerModule } from './common/logger/logger.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LogsModule } from './logs/logs.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CleanupService } from './tasks/cleanup.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { IpBlacklistModule } from './common/security/ip-blacklist.module';
import { IpBlacklistMiddleware } from './common/security/ip-blacklist.middleware';
import { EmailModule } from './common/email/email.module';
import { MarketModule } from './market/market.module';
import { StrategiesModule } from './strategies/strategies.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { BullModule } from '@nestjs/bullmq';
import { AlertsModule } from './alerts/alerts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { BacktestModule } from './backtest/backtest.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    IpBlacklistModule,
    EmailModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 ses
        limit: 100, // 100 requests (Global Default)
      },
    ]),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    LoggerModule,
    AuthModule,
    UsersModule,
    LogsModule,
    MarketModule,
    StrategiesModule,
    WatchlistModule,
    AlertsModule,
    NotificationsModule,
    MetricsModule,
    BacktestModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    CleanupService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IpBlacklistMiddleware).forRoutes('*');
  }
}
