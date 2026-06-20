import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { MarketCacheService } from '../market/market-cache.service';
import { AlertsService } from './alerts.service';

@Processor('price-check')
@Injectable()
export class PriceCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(PriceCheckProcessor.name);

  constructor(
    private readonly prisma: ExtendedPrismaService,
    private readonly marketCacheService: MarketCacheService,
    private readonly alertsService: AlertsService,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ symbol: string }, any, string>): Promise<void> {
    const { symbol } = job.data;

    // 1. 取得 Redis 最新價格快取
    const latestPrice = await this.marketCacheService.getPrice(symbol);
    if (latestPrice === null) {
      this.logger.warn(`No cached price found for ${symbol}, skipping check.`);
      return;
    }

    // 2. 查詢該交易對當前所有活躍且未觸發的告警
    const activeAlerts = await this.prisma.client.priceAlert.findMany({
      where: {
        symbol,
        isActive: true,
        isTriggered: false,
      },
    });

    if (activeAlerts.length === 0) {
      return;
    }

    let hasStateChange = false;

    // 3. 逐一比對告警條件
    for (const alert of activeAlerts) {
      const targetPrice = Number(alert.targetPrice);
      let isTriggered = false;

      if (alert.condition === 'ABOVE' && latestPrice >= targetPrice) {
        isTriggered = true;
      } else if (alert.condition === 'BELOW' && latestPrice <= targetPrice) {
        isTriggered = true;
      }

      if (isTriggered) {
        this.logger.log(
          `ALERT TRIGGERED: ${symbol} price ${latestPrice} met condition ${alert.condition} ${targetPrice} for user ${alert.userId}`,
        );

        // 4. 更新資料庫狀態 (使用 optimistic locking 防止複寫用戶修改的設定)
        try {
          await this.prisma.client.priceAlert.update({
            where: {
              id: alert.id,
              isActive: true,
              isTriggered: false,
              updatedAt: alert.updatedAt,
            },
            data: {
              isActive: false,
              isTriggered: true,
              triggeredAt: new Date(),
            },
          });

          hasStateChange = true;

          // 5. 推送通知工作至 notification.queue (解耦異步通知處理)
          await this.notificationQueue.add(
            'send-notification',
            {
              alertId: alert.id,
              userId: alert.userId,
              symbol: alert.symbol,
              condition: alert.condition,
              targetPrice,
              triggeredPrice: latestPrice,
            },
            {
              attempts: 3, // 重試3次
              backoff: {
                type: 'exponential',
                delay: 2000, // 指數退避，初始延遲 2 秒
              },
            },
          );
          this.logger.debug(`Enqueued notification job for alert: ${alert.id}`);
        } catch (err: any) {
          if (err.code === 'P2025') {
            this.logger.warn(`Alert ${alert.id} was concurrently modified or deleted, skipping trigger.`);
            continue;
          }
          this.logger.error(`Failed to trigger alert or enqueue notification for ${alert.id}`, err?.stack);
        }
      }
    }

    // 4. 若有狀態改變，更新 Redis 中的活躍狀態標的
    if (hasStateChange) {
      await this.alertsService.updateRedisSymbolStatus(symbol);
    }
  }
}
