import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { PriceCheckProcessor } from './price-check.processor';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    MarketModule,
    BullModule.registerQueue(
      {
        name: 'price-check',
        defaultJobOptions: {
          removeOnComplete: true, // 處理成功後自動移除任務記錄，防止 Redis 膨脹
          removeOnFail: 100,      // 失敗任務最多保留 100 筆以供除錯
        },
      },
      {
        name: 'notification',
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: 500,
        },
      },
    ),
  ],
  controllers: [AlertsController],
  providers: [AlertsService, PriceCheckProcessor],
  exports: [AlertsService, BullModule],
})
export class AlertsModule {}
