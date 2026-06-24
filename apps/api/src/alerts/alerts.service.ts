import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { BinanceService } from '../market/binance.service';
import { MarketCacheService } from '../market/market-cache.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly REDIS_ACTIVE_SYMBOLS_KEY = 'alerts:active_symbols';

  constructor(
    private readonly prisma: ExtendedPrismaService,
    private readonly redisService: RedisService,
    private readonly binanceService: BinanceService,
    private readonly marketCacheService: MarketCacheService,
  ) {}

  async onModuleInit() {
    // 啟動時同步資料庫中所有活躍的告警標的至 Redis Set
    await this.syncActiveSymbols();
  }

  private get redisClient() {
    return this.redisService.getClient();
  }

  /**
   * 同步資料庫中所有 isActive === true 且未觸發的告警交易對至 Redis
   */
  async syncActiveSymbols(): Promise<void> {
    try {
      const activeAlerts = await this.prisma.client.priceAlert.findMany({
        where: {
          isActive: true,
          isTriggered: false,
        },
        select: {
          symbol: true,
        },
      });

      const uniqueSymbols = Array.from(new Set(activeAlerts.map((a: { symbol: string }) => a.symbol)));

      // 先清除 Redis Set，再重新寫入，確保狀態一致
      await this.redisClient.del(this.REDIS_ACTIVE_SYMBOLS_KEY);
      if (uniqueSymbols.length > 0) {
        await this.redisClient.sadd(this.REDIS_ACTIVE_SYMBOLS_KEY, ...uniqueSymbols);
      }
    } catch (err) {
      console.error('Failed to sync active symbols from DB to Redis:', err);
    }
  }

  /**
   * 新增價格告警
   */
  async create(userId: string, dto: CreateAlertDto) {
    const symbol = dto.symbol.toUpperCase();

    // 1. 驗證交易對合法性 (優先查快取，次查 Binance API)
    const cachedPrice = await this.marketCacheService.getPrice(symbol);
    if (cachedPrice === null) {
      const validSymbols = await this.binanceService.getUSDTFuturesSymbols();
      if (!validSymbols.includes(symbol)) {
        throw new BadRequestException('不支援的交易對，僅限 USDT 永續合約');
      }
    }

    // 2. 寫入資料庫
    const alert = await this.prisma.client.priceAlert.create({
      data: {
        userId,
        symbol,
        condition: dto.condition,
        targetPrice: new Prisma.Decimal(dto.targetPrice),
        isActive: true,
        isTriggered: false,
      },
    });

    // 3. 加入 Redis 活躍標的 Set
    await this.redisClient.sadd(this.REDIS_ACTIVE_SYMBOLS_KEY, symbol);

    return alert;
  }

  /**
   * 取得使用者所有告警設定
   */
  async findAll(userId: string) {
    const alerts = await this.prisma.client.priceAlert.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (alerts.length === 0) {
      return [];
    }

    const symbols = Array.from(new Set(alerts.map((a) => a.symbol)));
    const prices = await this.marketCacheService.getPrices(symbols);

    return alerts.map((alert) => ({
      ...alert,
      currentPrice: prices[alert.symbol] ?? null,
    }));
  }

  /**
   * 啟用/關閉告警
   */
  async toggle(userId: string, id: string) {
    const alert = await this.prisma.client.priceAlert.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!alert) {
      throw new NotFoundException('找不到該告警設定');
    }

    const nextActive = !alert.isActive;

    // 更新資料庫狀態。如果是啟用，且原本是已觸發狀態，則重置觸發狀態
    const updated = await this.prisma.client.priceAlert.update({
      where: { id },
      data: {
        isActive: nextActive,
        ...(nextActive && { isTriggered: false, triggeredAt: null }),
      },
    });

    // 維護 Redis Set 狀態
    await this.updateRedisSymbolStatus(alert.symbol);

    return updated;
  }

  /**
   * 刪除價格告警
   */
  async remove(userId: string, id: string) {
    const alert = await this.prisma.client.priceAlert.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!alert) {
      throw new NotFoundException('找不到該告警設定');
    }

    await this.prisma.client.priceAlert.delete({
      where: { id },
    });

    // 維護 Redis Set 狀態
    await this.updateRedisSymbolStatus(alert.symbol);

    return { message: '告警設定已刪除' };
  }

  /**
   * 編輯價格告警
   */
  async update(userId: string, id: string, dto: UpdateAlertDto) {
    const alert = await this.prisma.client.priceAlert.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!alert) {
      throw new NotFoundException('找不到該告警設定');
    }

    const dataToUpdate: Prisma.PriceAlertUpdateInput = {};

    if (dto.symbol) {
      const symbol = dto.symbol.toUpperCase();
      // 驗證交易對合法性 (優先查快取，次查 Binance API)
      const cachedPrice = await this.marketCacheService.getPrice(symbol);
      if (cachedPrice === null) {
        const validSymbols = await this.binanceService.getUSDTFuturesSymbols();
        if (!validSymbols.includes(symbol)) {
          throw new BadRequestException('不支援的交易對，僅限 USDT 永續合約');
        }
      }
      dataToUpdate.symbol = symbol;
    }

    if (dto.condition) {
      dataToUpdate.condition = dto.condition;
    }

    if (dto.targetPrice !== undefined) {
      dataToUpdate.targetPrice = new Prisma.Decimal(dto.targetPrice);
    }

    // 只要修改編輯，就重設為活躍狀態並清空觸發紀錄
    dataToUpdate.isActive = true;
    dataToUpdate.isTriggered = false;
    dataToUpdate.triggeredAt = null;

    const updated = await this.prisma.client.priceAlert.update({
      where: { id },
      data: dataToUpdate,
    });

    // 維護 Redis Set 狀態
    if (dto.symbol && dto.symbol.toUpperCase() !== alert.symbol) {
      await this.updateRedisSymbolStatus(alert.symbol);
      await this.updateRedisSymbolStatus(dto.symbol.toUpperCase());
    } else {
      await this.updateRedisSymbolStatus(alert.symbol);
    }

    return updated;
  }

  /**
   * 檢查資料庫是否還有該交易對的其他活躍告警，若無則從 Redis 移除該交易對
   */
  async updateRedisSymbolStatus(symbol: string): Promise<void> {
    const activeCount = await this.prisma.client.priceAlert.count({
      where: {
        symbol,
        isActive: true,
        isTriggered: false,
      },
    });

    if (activeCount > 0) {
      await this.redisClient.sadd(this.REDIS_ACTIVE_SYMBOLS_KEY, symbol);
    } else {
      await this.redisClient.srem(this.REDIS_ACTIVE_SYMBOLS_KEY, symbol);
    }
  }
}
