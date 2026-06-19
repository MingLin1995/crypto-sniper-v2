import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { TelegramBotService } from '../auth/telegram-bot.service';
import { SubscribeWebPushDto } from './dto/subscribe-web-push.dto';
import { UnsubscribeWebPushDto } from './dto/unsubscribe-web-push.dto';
import axios from 'axios';
import * as webpush from 'web-push';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: ExtendedPrismaService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  onModuleInit() {
    const vapidSubject = this.configService.get<string>('VAPID_SUBJECT');
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (vapidSubject && vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.logger.log('Web Push VAPID keys successfully configured.');
    } else {
      this.logger.warn('Web Push VAPID keys are missing/incomplete in environment. Web Push will not function.');
    }
  }

  async sendAlertNotification(data: {
    userId: string;
    symbol: string;
    condition: string;
    targetPrice: number;
    triggeredPrice: number;
  }): Promise<void> {
    const { userId, symbol, condition, targetPrice, triggeredPrice } = data;

    // 1. 查詢用戶資訊與 Web Push 訂閱 (且確認用戶未被軟刪除)
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { webSubscriptions: true },
    });

    if (!user) {
      this.logger.warn(`User with ID ${userId} not found or has been soft-deleted. Skipping notification.`);
      return;
    }

    const timeStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const conditionStr = condition === 'ABOVE' ? '高於 (>=)' : '低於 (<=)';

    // === Telegram 通知 ===
    if (user.telegramChatId) {
      const telegramText =
        `🚨 <b>CryptoSniper 到價告警觸發</b> 🚨\n\n` +
        `<b>交易對:</b> ${symbol}\n` +
        `<b>觸發價格:</b> ${triggeredPrice}\n` +
        `<b>條件:</b> ${conditionStr}\n` +
        `<b>目標價格:</b> ${targetPrice}\n` +
        `<b>觸發時間:</b> ${timeStr}`;

      try {
        await this.telegramBotService.sendMessage(user.telegramChatId, telegramText, 'HTML');
        this.logger.debug(`Telegram notification sent successfully to chat ${user.telegramChatId}`);
      } catch (err: any) {
        this.logger.error(`Failed to send Telegram notification to user ${userId}: ${err.message}`);
      }
    }

    // === Discord Webhook 通知 ===
    if (user.discordWebhook) {
      try {
        await axios.post(user.discordWebhook, {
          embeds: [
            {
              title: '🚨 CryptoSniper 到價告警觸發 🚨',
              color: 16711680, // 紅色
              fields: [
                { name: '交易對', value: symbol, inline: true },
                { name: '觸發價格', value: triggeredPrice.toString(), inline: true },
                { name: '條件', value: conditionStr, inline: true },
                { name: '目標價格', value: targetPrice.toString(), inline: true },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        });
        this.logger.debug(`Discord notification sent successfully to webhook for user ${userId}`);
      } catch (err: any) {
        this.logger.error(`Failed to send Discord webhook to user ${userId}: ${err.message}`);
      }
    }

    // === Web Push 通知 ===
    if (user.webSubscriptions && user.webSubscriptions.length > 0) {
      const payload = JSON.stringify({
        title: '🚨 CryptoSniper 到價告警 🚨',
        body: `${symbol} 已達到目標價格 ${targetPrice}！目前價格為 ${triggeredPrice}。`,
        icon: '/logo.png',
        data: {
          url: '/alerts',
        },
      });

      for (const sub of user.webSubscriptions) {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };
          await webpush.sendNotification(pushSubscription, payload);
          this.logger.debug(`Web Push notification sent successfully to endpoint ${sub.endpoint}`);
        } catch (err: any) {
          // 404 (Not Found) 或 410 (Gone) 代表訂閱已過期或失效，應自資料庫中移除
          if (err.statusCode === 410 || err.statusCode === 404) {
            this.logger.log(`Removing expired Web Push subscription (ID: ${sub.id}, status: ${err.statusCode})`);
            await this.prisma.client.webSubscription
              .delete({
                where: { id: sub.id },
              })
              .catch((deleteErr: any) => {
                this.logger.error(`Failed to clean up Web Push subscription ${sub.id}: ${deleteErr.message}`);
              });
          } else {
            this.logger.error(`Failed to send Web Push to subscription ${sub.id}: ${err.message}`);
          }
        }
      }
    }
  }

  async subscribeWebPush(userId: string, dto: SubscribeWebPushDto) {
    return this.prisma.client.webSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: {
        p256dh: dto.p256dh,
        auth: dto.auth,
        userId,
      },
      create: {
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
        userId,
      },
    });
  }

  async unsubscribeWebPush(userId: string, dto: UnsubscribeWebPushDto) {
    const existing = await this.prisma.client.webSubscription.findFirst({
      where: { endpoint: dto.endpoint, userId },
    });

    if (existing) {
      await this.prisma.client.webSubscription.delete({
        where: { id: existing.id },
      });
      return { success: true };
    }

    return { success: false };
  }

  getVapidPublicKey(): string {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') || '';
  }
}
