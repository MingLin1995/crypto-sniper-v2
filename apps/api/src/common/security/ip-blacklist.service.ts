import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ExtendedPrismaService } from '../prisma/extended-prisma.service';
import { RedisService } from '../redis/redis.service';
import { PaginationDto } from '../dto/pagination.dto';
import { calculatePagination, createPaginatedResponse } from '../utils/pagination.helper';

@Injectable()
export class IpBlacklistService implements OnModuleInit {
  private readonly logger = new Logger(IpBlacklistService.name);
  private readonly INITIALIZED_KEY = 'security:blacklist:initialized';
  private readonly BLACKLIST_SET_KEY = 'security:blacklist:ips';
  private isInitializedInMemory = false;

  constructor(
    private readonly prisma: ExtendedPrismaService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.initializeCache();
  }

  /**
   * 從資料庫初始化 Redis 黑名單快取（若尚未初始化）。
   * 自我修復機制：於快取失效或模組啟動時執行。
   */
  async initializeCache(force = false): Promise<void> {
    if (this.isInitializedInMemory && !force) {
      return;
    }
    try {
      const redis = this.redisService.getClient();
      const isInitialized = await redis.get(this.INITIALIZED_KEY);

      if (!isInitialized || force) {
        this.logger.log('正在從資料庫初始化 IP 黑名單快取...');
        
        // 自 Postgres 取得所有被封鎖的 IP
        const records = await this.prisma.client.blacklistedIp.findMany({
          select: { ip: true },
        });

        const ips = records.map((r) => r.ip);

        // 先清除舊的 Set 資料，如果有記錄再重新寫入
        await redis.del(this.BLACKLIST_SET_KEY);
        if (ips.length > 0) {
          await redis.sadd(this.BLACKLIST_SET_KEY, ...ips);
        }

        // 設定初始化完成標記
        await redis.set(this.INITIALIZED_KEY, '1');
        this.logger.log(`IP 黑名單快取初始化完成，共載入 ${ips.length} 筆 IP。`);
      }
      this.isInitializedInMemory = true;
    } catch (error) {
      this.logger.error('初始化 IP 黑名單快取失敗：', error);
      // 不阻斷請求流程；若 Redis 失敗則改由 DB 查詢。
    }
  }

  /**
   * 檢查 IP 是否在黑名單中，使用 Redis Set 進行 O(1) 效能查詢。
   */
  async isIpBlacklisted(ip: string): Promise<boolean> {
    if (!ip) return false;

    // 確保快取已完成初始化
    if (!this.isInitializedInMemory) {
      await this.initializeCache();
    }

    try {
      const redis = this.redisService.getClient();
      
      // 快速檢查 Redis 端的初始化標記是否存在，避免 Redis 被 Evict/重啟後遺失 Set 資料而導致漏防
      const isInitializedInRedis = await redis.exists(this.INITIALIZED_KEY);
      if (isInitializedInRedis === 0) {
        this.logger.warn('IP blacklist cache initialized key is missing in Redis. Re-initializing...');
        this.isInitializedInMemory = false;
        await this.initializeCache(true);
      }

      const isMember = await redis.sismember(this.BLACKLIST_SET_KEY, ip);
      return isMember === 1;
    } catch (error) {
      this.logger.error(`對 IP ${ip} 進行 Redis 檢查失敗，降級改由 DB 查詢：`, error);
      
      // 若 Redis 斷線，直接降級改用資料庫查詢
      const record = await this.prisma.client.blacklistedIp.findUnique({
        where: { ip },
        select: { ip: true },
      });
      return !!record;
    }
  }

  /**
   * 將 IP 新增至黑名單（寫入 PostgreSQL 並同步更新 Redis 快取）。
   */
  async blacklistIp(ip: string, reason?: string) {
    this.logger.warn(`正在封鎖 IP：${ip}，原因：${reason || '無'}`);

    // 更新資料庫
    const record = await this.prisma.client.blacklistedIp.upsert({
      where: { ip },
      update: { reason, updatedAt: new Date() },
      create: { ip, reason },
    });

    // 更新 Redis 快取
    try {
      const redis = this.redisService.getClient();
      await redis.sadd(this.BLACKLIST_SET_KEY, ip);
      await redis.set(this.INITIALIZED_KEY, '1'); // 確保標記為已初始化
      this.isInitializedInMemory = true;
    } catch (error) {
      this.logger.error(`封鎖 IP ${ip} 後更新 Redis 快取失敗：`, error);
    }

    return record;
  }

  /**
   * 將 IP 自黑名單中移除（白名單化）。
   */
  async whitelistIp(ip: string) {
    this.logger.log(`正在解鎖 IP：${ip}`);

    // 更新資料庫
    try {
      await this.prisma.client.blacklistedIp.delete({
        where: { ip },
      });
    } catch (error) {
      // 若資料庫中已無該 IP，忽略此刪除錯誤
      this.logger.warn(`解鎖時在資料庫中找不到 IP ${ip}。`);
    }

    // 更新 Redis 快取
    try {
      const redis = this.redisService.getClient();
      await redis.srem(this.BLACKLIST_SET_KEY, ip);
    } catch (error) {
      this.logger.error(`解鎖 IP ${ip} 後更新 Redis 快取失敗：`, error);
    }

    return { message: 'IP 已自黑名單中移除' };
  }

  /**
   * 分頁查詢所有黑名單 IP。
   */
  async getBlacklistedIps(paginationDto: PaginationDto) {
    const { skip, take } = calculatePagination(paginationDto);
    const page = paginationDto.page ?? 1;
    const limit = paginationDto.limit ?? 10;

    const [data, total] = await Promise.all([
      this.prisma.client.blacklistedIp.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.blacklistedIp.count(),
    ]);

    return createPaginatedResponse(data, page, limit, total);
  }
}
