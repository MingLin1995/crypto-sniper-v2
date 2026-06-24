import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { MarketCacheService } from '../market/market-cache.service';
import { BinanceService } from '../market/binance.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';

@Injectable()
export class WatchlistService {
  constructor(
    private readonly prisma: ExtendedPrismaService,
    private readonly marketCacheService: MarketCacheService,
    private readonly binanceService: BinanceService,
  ) {}

  /**
   * 新增追蹤標的
   */
  async create(userId: string, dto: CreateWatchlistDto) {
    const symbol = dto.symbol.toUpperCase();

    // 1. 驗證標的合法性 (優先查 Redis 快取，次查 Binance API 列表)
    const cachedPrice = await this.marketCacheService.getPrice(symbol);
    if (cachedPrice === null) {
      try {
        const validSymbols = await this.binanceService.getUSDTFuturesSymbols();
        if (!validSymbols.includes(symbol)) {
          throw new BadRequestException('不支援的交易對，僅限 USDT 永續合約');
        }
      } catch (err) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        throw new BadRequestException('無法驗證交易對，請稍後再試');
      }
    }

    // 2. 檢查是否已在追蹤清單中
    const existing = await this.prisma.client.watchlistItem.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol,
        },
      },
    });

    if (existing) {
      throw new ConflictException('該交易對已在您的追蹤清單中');
    }

    // 3. 儲存新追蹤項目
    return this.prisma.client.watchlistItem.create({
      data: {
        userId,
        symbol,
      },
    });
  }

  /**
   * 取得用戶所有追蹤清單與即時快取價格
   */
  async findAll(userId: string) {
    // 1. 讀取資料庫追蹤清單
    const items = await this.prisma.client.watchlistItem.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (items.length === 0) {
      return [];
    }

    // 2. 批次取得 Redis 快取價格
    const symbols = items.map((item) => item.symbol);
    const prices = await this.marketCacheService.getPrices(symbols);

    // 3. 合併結果
    return items.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      price: prices[item.symbol] ?? null,
      createdAt: item.createdAt,
    }));
  }

  /**
   * 移除追蹤標的
   */
  async remove(userId: string, symbol: string) {
    const targetSymbol = symbol.toUpperCase();

    const existing = await this.prisma.client.watchlistItem.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: targetSymbol,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('追蹤標的不存在');
    }

    await this.prisma.client.watchlistItem.delete({
      where: {
        id: existing.id,
      },
    });

    return { message: '已成功移除追蹤' };
  }
}
