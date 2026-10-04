import { Injectable, Logger, Inject } from '@nestjs/common';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { BinanceService } from './binance.service';
import { OHLCVKline } from './types';
import { HistoricalKline } from '@prisma/client';

export function getIntervalMs(interval: string): number {
  const unit = interval.slice(-1);
  const val = parseInt(interval.slice(0, -1), 10);
  switch (unit) {
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    case 'w': return val * 7 * 24 * 60 * 60 * 1000;
    case 'M': return val * 30 * 24 * 60 * 60 * 1000; // Approximate month to 30 days
    default: throw new Error(`Unknown interval: ${interval}`);
  }
}

@Injectable()
export class HistoricalKlineService {
  private readonly logger = new Logger(HistoricalKlineService.name);
  private readonly symbolGenesisTimes = new Map<string, number>();

  constructor(
    @Inject(ExtendedPrismaService) private readonly prisma: ExtendedPrismaService,
    @Inject(BinanceService) private readonly binanceService: BinanceService,
  ) {}

  /**
   * 獲取指定交易對在幣安上的最早上市時間 (Genesis Time)，並快取於記憶體中。
   */
  async getSymbolGenesisTime(symbol: string, interval: string): Promise<number> {
    const cacheKey = `${symbol}_${interval}`;
    if (this.symbolGenesisTimes.has(cacheKey)) {
      return this.symbolGenesisTimes.get(cacheKey)!;
    }

    try {
      // 藉由 startTime = 0 且 limit = 1 來拉取該幣種的第一根 K 線
      const klines = await this.binanceService.getKlinesOHLCV(symbol, interval, 1, 0);
      if (klines && klines.length > 0) {
        const genesisTime = klines[0].openTime;
        this.symbolGenesisTimes.set(cacheKey, genesisTime);
        return genesisTime;
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to fetch genesis time for ${symbol} (${interval}), fallback to 2019-09-01: ${error.message}`,
      );
    }

    // 預設下限為 2019-09-01 (幣安永續合約上線時間)
    const defaultGenesis = 1567296000000;
    this.symbolGenesisTimes.set(cacheKey, defaultGenesis);
    return defaultGenesis;
  }

  /**
   * 確保資料庫中已有指定交易對及時間區間之連續 K 線資料，如有缺口則自動補齊。
   */
  async ensureKlines(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number,
  ): Promise<void> {
    const genesisTime = await this.getSymbolGenesisTime(symbol, interval);
    const adjustedStartTime = Math.max(startTime, genesisTime);

    if (adjustedStartTime >= endTime) {
      this.logger.log(
        `Adjusted start time ${new Date(adjustedStartTime).toISOString()} is >= end time ${new Date(endTime).toISOString()} for ${symbol} (${interval}), skipping ensureKlines.`,
      );
      return;
    }

    const rangeInfo = await this.prisma.historicalKline.aggregate({
      where: {
        symbol,
        interval,
        openTime: {
          gte: BigInt(adjustedStartTime),
          lte: BigInt(endTime),
        },
      },
      _count: true,
      _min: { openTime: true },
      _max: { openTime: true },
    });

    const count = rangeInfo._count;
    const intervalMs = getIntervalMs(interval);
    const expectedCount = Math.floor((endTime - adjustedStartTime) / intervalMs) + 1;

    // 若資料已 100% 覆蓋，則直接返回
    if (count > 0 && count === expectedCount) {
      this.logger.log(`Historical klines for ${symbol} (${interval}) in range [${new Date(adjustedStartTime).toISOString()} to ${new Date(endTime).toISOString()}] already fully covered. DB count: ${count}/${expectedCount}`);
      return;
    }

    // 獲取目前已有的所有 K 線 openTime，找出所有缺口
    const existingTimes = await this.prisma.historicalKline.findMany({
      where: {
        symbol,
        interval,
        openTime: {
          gte: BigInt(adjustedStartTime),
          lte: BigInt(endTime),
        },
      },
      select: { openTime: true },
      orderBy: { openTime: 'asc' },
    });

    const gaps: { start: number; end: number }[] = [];

    if (existingTimes.length === 0) {
      gaps.push({ start: adjustedStartTime, end: endTime });
    } else {
      // 1. 檢查開頭缺口
      const firstTime = Number(existingTimes[0].openTime);
      if (firstTime > adjustedStartTime) {
        if (firstTime - adjustedStartTime >= intervalMs) {
          gaps.push({ start: adjustedStartTime, end: firstTime - 1 });
        }
      }

      // 2. 檢查中間缺口
      for (let i = 0; i < existingTimes.length - 1; i++) {
        const current = Number(existingTimes[i].openTime);
        const next = Number(existingTimes[i + 1].openTime);
        if (next - current > intervalMs * 1.5) {
          gaps.push({ start: current + intervalMs, end: next - 1 });
        }
      }

      // 3. 檢查結尾缺口
      const lastTime = Number(existingTimes[existingTimes.length - 1].openTime);
      if (lastTime < endTime) {
        if (endTime - lastTime >= intervalMs) {
          gaps.push({ start: lastTime + intervalMs, end: endTime });
        }
      }
    }

    // 針對每個缺口進行分段拉取與補齊
    for (const gap of gaps) {
      await this.fetchAndSave(symbol, interval, gap.start, gap.end);
    }
  }

  /**
   * 自資料庫讀取指定交易對與區間之 K 線資料，並轉換為引擎的 OHLCVKline 格式。
   */
  async getKlinesFromDb(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number,
  ): Promise<OHLCVKline[]> {
    const rows = await this.prisma.historicalKline.findMany({
      where: {
        symbol,
        interval,
        openTime: {
          gte: BigInt(startTime),
          lte: BigInt(endTime),
        },
      },
      orderBy: {
        openTime: 'asc',
      },
    });

    return rows.map((r: HistoricalKline) => this.toEngineKline(r));
  }

  /**
   * 引擎 K 線物件型別映射
   */
  toEngineKline(dbRow: HistoricalKline): OHLCVKline {
    const intervalMs = getIntervalMs(dbRow.interval);
    const openTimeNum = Number(dbRow.openTime);
    return {
      openTime: openTimeNum,
      open: Number(dbRow.open),
      high: Number(dbRow.high),
      low: Number(dbRow.low),
      close: Number(dbRow.close),
      volume: Number(dbRow.volume),
      closeTime: openTimeNum + intervalMs - 1,
    };
  }

  private async fetchAndSave(
    symbol: string,
    interval: string,
    start: number,
    end: number,
  ): Promise<void> {
    this.logger.log(
      `Fetching historical klines for ${symbol} (${interval}) from ${new Date(start).toISOString()} to ${new Date(end).toISOString()}...`,
    );

    const klines = await this.binanceService.getKlinesOHLCVPaginated(symbol, interval, start, end);
    if (klines.length === 0) {
      this.logger.warn(`No klines returned from Binance for ${symbol} (${interval}) in range [${start}, ${end}]`);
      return;
    }

    const dataToInsert = klines.map((k) => ({
      symbol,
      interval,
      openTime: BigInt(k.openTime),
      open: k.open.toString(),
      high: k.high.toString(),
      low: k.low.toString(),
      close: k.close.toString(),
      volume: k.volume.toString(),
    }));

    let insertedCount = 0;
    const batchSize = 2000;
    for (let i = 0; i < dataToInsert.length; i += batchSize) {
      const batch = dataToInsert.slice(i, i + batchSize);
      const res = await this.prisma.historicalKline.createMany({
        data: batch,
        skipDuplicates: true,
      });
      insertedCount += res.count;
      // 釋放事件循環以保持 HTTP 伺服器響應
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    this.logger.log(
      `Successfully saved ${insertedCount} historical klines for ${symbol} (${interval}) (fetched ${klines.length} items)`,
    );

    // 資料庫行數統計監控
    const totalCount = await this.prisma.historicalKline.count({
      where: { symbol, interval },
    });
    this.logger.log(`Total ${symbol} (${interval}) klines in DB now: ${totalCount}`);
  }
}
