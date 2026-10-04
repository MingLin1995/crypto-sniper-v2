import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { BacktestProcessor } from './backtest.processor';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    PrismaModule,
    MarketModule,
    BullModule.registerQueue({
      name: 'backtest',
      defaultJobOptions: {
        removeOnComplete: 50, // Keep last 50 completed backtest records
        removeOnFail: 100,    // Keep last 100 failed records
      },
    }),
  ],
  controllers: [BacktestController],
  providers: [BacktestService, BacktestProcessor],
  exports: [BacktestService],
})
export class BacktestModule {}
