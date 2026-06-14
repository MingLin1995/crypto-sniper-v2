import { Module } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { MarketCacheService } from './market-cache.service';
import { MarketScheduleService } from './market-schedule.service';

@Module({
  providers: [BinanceService, MarketCacheService, MarketScheduleService],
  exports: [BinanceService, MarketCacheService, MarketScheduleService],
})
export class MarketModule {}
