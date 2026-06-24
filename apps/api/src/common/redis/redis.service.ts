import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  private metricsService?: MetricsService;

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.logger.log(`Connecting to Redis at ${redisUrl}...`);

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
      
      // 延遲解析 MetricsService，避免循環依賴
      try {
        this.metricsService = this.moduleRef.get(MetricsService, { strict: false });
      } catch (err) {
        this.logger.warn('MetricsService 在此階段尚未註冊或解析完成');
      }

      // Proxy client.get 以追蹤快取命中率
      const originalGet = this.client.get.bind(this.client);
      this.client.get = async (key: string, ...rest: any[]) => {
        const result = await originalGet(key, ...rest);
        if (this.metricsService) {
          if (result !== null) {
            this.metricsService.redisCacheHitsTotal.inc();
          } else {
            this.metricsService.redisCacheMissesTotal.inc();
          }
        }
        return result;
      };
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
      this.logger.log('Redis disconnected successfully');
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
