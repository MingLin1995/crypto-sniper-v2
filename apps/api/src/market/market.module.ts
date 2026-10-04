import { Module } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { MarketCacheService } from './market-cache.service';
import { MarketScheduleService } from './market-schedule.service';
import { ScreenerService } from './screener.service';
import { MarketController } from './market.controller';
import { BinanceWebsocketService } from './binance-websocket.service';
import { BullModule } from '@nestjs/bullmq';
import { HistoricalKlineService } from './historical-kline.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'price-check',
    }),
  ],
  controllers: [MarketController],
  providers: [
    BinanceService,
    MarketCacheService,
    MarketScheduleService,
    ScreenerService,
    BinanceWebsocketService,
    HistoricalKlineService,
  ],
  exports: [
    BinanceService,
    MarketCacheService,
    MarketScheduleService,
    ScreenerService,
    BinanceWebsocketService,
    HistoricalKlineService,
  ],
})
export class MarketModule {}

