import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';

interface NotificationJobData {
  alertId: string;
  userId: string;
  symbol: string;
  condition: string;
  targetPrice: number;
  triggeredPrice: number;
}

@Processor('notification')
@Injectable()
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationJobData, any, string>): Promise<void> {
    this.logger.debug(`Processing notification job ${job.id} for alert ${job.data.alertId}`);

    if (job.name === 'send-notification') {
      const { userId, symbol, condition, targetPrice, triggeredPrice } = job.data;

      try {
        await this.notificationsService.sendAlertNotification({
          userId,
          symbol,
          condition,
          targetPrice,
          triggeredPrice,
        });
      } catch (error: any) {
        this.logger.error(
          `Failed processing notification job ${job.id} for user ${userId}: ${error.message}`,
          error?.stack,
        );
        // 拋出錯誤讓 BullMQ 能進行配置好的重試與 DLQ 機制
        throw error;
      }
    } else {
      this.logger.warn(`Unknown job name in notification queue: ${job.name}`);
    }
  }
}
