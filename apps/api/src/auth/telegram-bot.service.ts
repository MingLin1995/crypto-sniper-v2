import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import axios from 'axios';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly prisma: ExtendedPrismaService,
  ) {}

  async onModuleInit() {
    const webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (webhookUrl && botToken) {
      // 確保 webhook 網址符合全域 prefix 設定 /api/auth/telegram/webhook
      const targetUrl = `${webhookUrl}/api/auth/telegram/webhook`;
      this.logger.log(`正在向 Telegram 註冊 Webhook: ${targetUrl}`);
      try {
        const response = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          url: targetUrl,
        });
        this.logger.log(`Telegram Webhook 註冊成功: ${JSON.stringify(response.data)}`);
      } catch (error: any) {
        this.logger.error(`Telegram Webhook 註冊失敗: ${error.message}`);
      }
    } else {
      this.logger.warn('未設定 TELEGRAM_WEBHOOK_URL 或 TELEGRAM_BOT_TOKEN，跳過 Webhook 自動註冊。');
    }
  }

  async handleWebhookUpdate(update: any) {
    this.logger.debug(`收到 Telegram Webhook 更新: ${JSON.stringify(update)}`);
    const message = update?.message;
    if (!message || !message.text) return;

    const text = message.text.trim();
    const chatId = message.chat.id;
    const fromId = message.from.id;

    if (text.startsWith('/start ')) {
      const token = text.split(' ')[1]?.trim();
      if (!token) {
        await this.sendMessage(chatId, '請提供正確的綁定 Token。');
        return;
      }

      const redisKey = `tg_link:${token}`;
      const redis = this.redisService.getClient();
      const userId = await redis.get(redisKey);

      if (userId) {
        try {
          const telegramIdStr = String(fromId);
          // 確保此 Telegram 帳號沒有被其他帳號綁定過
          const existingUser = await this.prisma.client.user.findFirst({
            where: {
              telegramId: telegramIdStr,
              id: { not: userId },
            },
          });

          if (existingUser) {
            await this.sendMessage(chatId, '綁定失敗：此 Telegram 帳號已綁定至其他平台帳號。');
            return;
          }

          // 更新用戶的 Telegram 資訊
          await this.prisma.client.user.update({
            where: { id: userId },
            data: {
              telegramId: telegramIdStr,
              telegramChatId: String(chatId),
            },
          });

          await this.sendMessage(chatId, '帳號綁定成功！您現在可以接收系統告警通知。');
          await redis.del(redisKey);
        } catch (error: any) {
          this.logger.error(`綁定 Telegram 用戶時發生錯誤: ${error.message}`);
          await this.sendMessage(chatId, '帳號綁定時發生伺服器錯誤，請稍後再試。');
        }
      } else {
        await this.sendMessage(chatId, '無效或已過期的連結 Token，請重新在網站上點擊綁定。');
      }
    } else if (text === '/start') {
      await this.sendMessage(chatId, '歡迎使用 CryptoSniper V2 告警機器人！請從系統設定頁面點擊「綁定 Telegram」並點擊連結開啟。');
    }
  }

  async sendMessage(chatId: string | number, text: string) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.error('無法發送 Telegram 訊息：TELEGRAM_BOT_TOKEN 未設定');
      return;
    }

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
      });
    } catch (error: any) {
      this.logger.error(`發送 Telegram 訊息至 ${chatId} 失敗: ${error.message}`);
    }
  }
}
