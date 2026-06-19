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
        findUnique: jest.fn(),
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
    it('應能正確處理 /start <token> 指令並啟用通知', async () => {
      const update = {
        message: {
          chat: { id: 999 },
          from: { id: 12345 },
          text: '/start valid-token',
        },
      };

      mockRedisClient.get.mockResolvedValue('user-id-abc');
      mockPrisma.client.user.findUnique.mockResolvedValue({ id: 'user-id-abc', telegramId: '12345' });
      mockPrisma.client.user.update.mockResolvedValue({ id: 'user-id-abc', telegramChatId: '999' });
      
      const spyPost = jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } } as any);

      await service.handleWebhookUpdate(update);

      expect(mockRedisClient.get).toHaveBeenCalledWith('tg_link:valid-token');
      expect(mockPrisma.client.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id-abc' },
      });
      expect(mockPrisma.client.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-abc' },
        data: {
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

      mockRedisClient.get.mockResolvedValue(null);
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

    it('若 Telegram ID 與網站上綁定的登入帳戶不符，應通知啟用失敗', async () => {
      const update = {
        message: {
          chat: { id: 999 },
          from: { id: 12345 },
          text: '/start valid-token',
        },
      };

      mockRedisClient.get.mockResolvedValue('user-id-abc');
      mockPrisma.client.user.findUnique.mockResolvedValue({ id: 'user-id-abc', telegramId: 'different-id' });
      const spyPost = jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } } as any);

      await service.handleWebhookUpdate(update);

      expect(mockPrisma.client.user.update).not.toHaveBeenCalled();
      expect(spyPost).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:fake-token/sendMessage',
        {
          chat_id: 999,
          text: '啟用失敗：您的 Telegram 帳戶與網站上綁定的登入帳戶不符，請確認您使用的是同一個 Telegram 帳戶。',
        },
      );
    });

    it('若用戶尚未連結 Telegram 帳號，應通知啟用失敗', async () => {
      const update = {
        message: {
          chat: { id: 999 },
          from: { id: 12345 },
          text: '/start valid-token',
        },
      };

      mockRedisClient.get.mockResolvedValue('user-id-abc');
      mockPrisma.client.user.findUnique.mockResolvedValue({ id: 'user-id-abc', telegramId: null });
      const spyPost = jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } } as any);

      await service.handleWebhookUpdate(update);

      expect(mockPrisma.client.user.update).not.toHaveBeenCalled();
      expect(spyPost).toHaveBeenCalledWith(
        'https://api.telegram.org/bot123456:fake-token/sendMessage',
        {
          chat_id: 999,
          text: '啟用失敗：請先在網站的「個人設定」連結您的 Telegram 帳號（登入帳戶），然後再來此處啟用通知。',
        },
      );
    });
  });
});
