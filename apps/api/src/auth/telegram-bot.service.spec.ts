import { Test, TestingModule } from '@nestjs/testing';
import { TelegramBotService } from './telegram-bot.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import axios from 'axios';

describe('TelegramBotService (Telegram 機器人服務)', () => {
  let service: TelegramBotService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'TELEGRAM_BOT_TOKEN') return '123456:fake-token';
      if (key === 'TELEGRAM_BOT_USERNAME') return 'fake_bot';
      return null;
    }),
  };

  const mockRedisClient = {
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockPrisma = {
    client: {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramBotService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ExtendedPrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TelegramBotService>(TelegramBotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('服務應該要被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('handleWebhookUpdate', () => {
    it('應能正確處理 /start <token> 指令並綁定帳號', async () => {
      const update = {
        message: {
          chat: { id: 999 },
          from: { id: 12345 },
          text: '/start valid-token',
        },
      };

      mockRedisClient.get.mockResolvedValue('user-id-abc');
      mockPrisma.client.user.findFirst.mockResolvedValue(null); // 沒有衝突
      mockPrisma.client.user.update.mockResolvedValue({ id: 'user-id-abc', telegramId: '12345' });
      
      const spyPost = jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } } as any);

      await service.handleWebhookUpdate(update);

      expect(mockRedisClient.get).toHaveBeenCalledWith('tg_link:valid-token');
      expect(mockPrisma.client.user.findFirst).toHaveBeenCalled();
      expect(mockPrisma.client.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-abc' },
        data: {
          telegramId: '12345',
          telegramChatId: '999',
        },
      });
      expect(mockRedisClient.del).toHaveBeenCalledWith('tg_link:valid-token');
      expect(spyPost).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:fake-token/sendMessage',
        {
          chat_id: 999,
          text: '到價通知啟用成功！您現在可以接收系統的即時策略到價通知。',
        },
      );
    });

    it('若 Token 已過期應發送無效訊息', async () => {
      const update = {
        message: {
          chat: { id: 999 },
          from: { id: 12345 },
          text: '/start expired-token',
        },
      };

      mockRedisClient.get.mockResolvedValue(null); // Token 不存在或已過期
      const spyPost = jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } } as any);

      await service.handleWebhookUpdate(update);

      expect(mockRedisClient.get).toHaveBeenCalledWith('tg_link:expired-token');
      expect(mockPrisma.client.user.update).not.toHaveBeenCalled();
      expect(spyPost).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:fake-token/sendMessage',
        {
          chat_id: 999,
          text: '無效或已過期的連結 Token，請重新在網站上點擊綁定。',
        },
      );
    });

    it('若 Telegram ID 已被其他帳號綁定，應通知綁定失敗', async () => {
      const update = {
        message: {
          chat: { id: 999 },
          from: { id: 12345 },
          text: '/start valid-token',
        },
      };

      mockRedisClient.get.mockResolvedValue('user-id-abc');
      mockPrisma.client.user.findFirst.mockResolvedValue({ id: 'another-user-id' }); // 衝突！
      const spyPost = jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } } as any);

      await service.handleWebhookUpdate(update);

      expect(mockPrisma.client.user.update).not.toHaveBeenCalled();
      expect(spyPost).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:fake-token/sendMessage',
        {
          chat_id: 999,
          text: '綁定失敗：此 Telegram 帳號已綁定至其他平台帳號。',
        },
      );
    });
  });
});
