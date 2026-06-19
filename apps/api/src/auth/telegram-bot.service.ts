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
      // 使用 BOT_TOKEN 作為安全路徑後綴，避免被外部惡意存取
      const targetUrl = `${webhookUrl}/api/auth/telegram/webhook/${botToken}`;
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
          // 確保用戶已在網站綁定 telegramId，且與發送者一致
          const user = await this.prisma.client.user.findUnique({
            where: { id: userId },
          });

          if (!user) {
            await this.sendMessage(chatId, '啟用失敗：用戶不存在。');
            return;
          }

          if (!user.telegramId) {
            await this.sendMessage(
              chatId,
              '啟用失敗：請先在網站的「個人設定」連結您的 Telegram 帳號（登入帳戶），然後再來此處啟用通知。',
            );
            return;
          }

          if (user.telegramId !== telegramIdStr) {
            await this.sendMessage(
              chatId,
              '啟用失敗：您的 Telegram 帳戶與網站上綁定的登入帳戶不符，請確認您使用的是同一個 Telegram 帳戶。',
            );
            return;
          }

          // 僅更新 telegramChatId 用於發送通知
          await this.prisma.client.user.update({
            where: { id: userId },
            data: {
              telegramChatId: String(chatId),
            },
          });

          await this.sendMessage(chatId, '到價通知啟用成功！您現在可以接收系統的即時策略到價通知。');
          await redis.del(redisKey);
        } catch (error: any) {
          this.logger.error(`綁定 Telegram 用戶時發生錯誤: ${error.message}`);
          await this.sendMessage(chatId, '帳號綁定時發生伺服器錯誤，請稍後再試。');
        }
      } else {
        await this.sendMessage(chatId, '無效或已過期的連結 Token，請重新在網站上點擊綁定。');
      }
    } else if (text === '/start') {
      await this.sendMessage(chatId, '歡迎使用 CryptoSniper V2 到價通知機器人！請從系統設定頁面點擊「綁定 Telegram」並點擊連結開啟。');
    }
  }

  async sendMessage(chatId: string | number, text: string, parseMode?: string) {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.error('無法發送 Telegram 訊息：TELEGRAM_BOT_TOKEN 未設定');
      return;
    }

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
      });
    } catch (error: any) {
      this.logger.error(`發送 Telegram 訊息至 ${chatId} 失敗: ${error.message}`);
    }
  }
}
