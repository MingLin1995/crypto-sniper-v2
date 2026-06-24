import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'price-check' },
      { name: 'notification' }
    ),
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
