import { Module } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { MarketCacheService } from './market-cache.service';
import { MarketScheduleService } from './market-schedule.service';
import { ScreenerService } from './screener.service';
import { MarketController } from './market.controller';

@Module({
  controllers: [MarketController],
  providers: [BinanceService, MarketCacheService, MarketScheduleService, ScreenerService],
  exports: [BinanceService, MarketCacheService, MarketScheduleService, ScreenerService],
})
export class MarketModule {}

