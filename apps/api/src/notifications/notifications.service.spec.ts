import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { TelegramBotService } from '../auth/telegram-bot.service';
import axios from 'axios';
import * as webpush from 'web-push';

jest.mock('axios', () => ({
  post: jest.fn(),
  default: {
    post: jest.fn(),
  },
}));
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrismaClient: any;
  let mockTelegramBotService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockPrismaClient = {
      user: {
        findFirst: jest.fn(),
      },
      webSubscription: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockTelegramBotService = {
      sendMessage: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'VAPID_SUBJECT') return 'mailto:test@example.com';
        if (key === 'VAPID_PUBLIC_KEY') return 'fake-public-key';
        if (key === 'VAPID_PRIVATE_KEY') return 'fake-private-key';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ExtendedPrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
        {
          provide: TelegramBotService,
          useValue: mockTelegramBotService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('NotificationsService 應該被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('若有完整 VAPID 設定，應正確初始化 web-push', () => {
      service.onModuleInit();
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        'mailto:test@example.com',
        'fake-public-key',
        'fake-private-key',
      );
    });

    it('若缺乏 VAPID 設定，應跳過 web-push 初始化並印出警告', () => {
      mockConfigService.get.mockImplementation(() => null);
      service.onModuleInit();
      expect(webpush.setVapidDetails).not.toHaveBeenCalled();
    });
  });

  describe('sendAlertNotification', () => {
    const mockAlertData = {
      userId: 'user-123',
      symbol: 'BTCUSDT',
      condition: 'ABOVE',
      targetPrice: 60000,
      triggeredPrice: 61000,
    };

    it('若找不到用戶或用戶已軟刪除，應直接跳過發送', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue(null);

      await service.sendAlertNotification(mockAlertData);

      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-123', deletedAt: null },
        include: { webSubscriptions: true },
      });
      expect(mockTelegramBotService.sendMessage).not.toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('若用戶綁定了 Telegram，應發送 Telegram 訊息', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-123',
        telegramChatId: '11223344',
        discordWebhook: null,
        webSubscriptions: [],
      });

      await service.sendAlertNotification(mockAlertData);

      expect(mockTelegramBotService.sendMessage).toHaveBeenCalledWith(
        '11223344',
        expect.stringContaining('BTCUSDT'),
        'HTML',
      );
    });

    it('若用戶設定了 Discord Webhook，應發送 Discord Embed 通知', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-123',
        telegramChatId: null,
        discordWebhook: 'https://discord.com/api/webhooks/123456789/test_webhook_token',
        webSubscriptions: [],
      });
      (axios.post as jest.Mock).mockResolvedValue({ data: 'ok' });

      await service.sendAlertNotification(mockAlertData);

      expect(axios.post).toHaveBeenCalledWith('https://discord.com/api/webhooks/123456789/test_webhook_token', {
        embeds: [
          expect.objectContaining({
            title: '🚨 CryptoSniper 到價通知觸發 🚨',
            fields: expect.arrayContaining([
              expect.objectContaining({ name: '交易對', value: 'BTCUSDT' }),
              expect.objectContaining({ name: '觸發價格', value: '61000' }),
            ]),
          }),
        ],
      });
    });

    it('若用戶設定了非 Discord 官方網址或 SSRF 可疑網址，應拒絕發送', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-123',
        telegramChatId: null,
        discordWebhook: 'http://169.254.169.254/latest/meta-data/',
        webSubscriptions: [],
      });

      await service.sendAlertNotification(mockAlertData);

      expect(axios.post).not.toHaveBeenCalled();
    });

    it('若用戶註冊了 Web Push 訂閱，應發送 Web Push 通知', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-123',
        telegramChatId: null,
        discordWebhook: null,
        webSubscriptions: [
          {
            id: 'sub-1',
            endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/endpoint123',
            p256dh: 'p256',
            auth: 'auth_secret',
          },
        ],
      });
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      await service.sendAlertNotification(mockAlertData);

      expect(webpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/endpoint123',
          keys: {
            p256dh: 'p256',
            auth: 'auth_secret',
          },
        },
        expect.any(String),
      );
    });

    it('若用戶註冊的 Web Push 端點非受信任網域，應拒絕發送', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-123',
        telegramChatId: null,
        discordWebhook: null,
        webSubscriptions: [
          {
            id: 'sub-1',
            endpoint: 'http://127.0.0.1:8080/push',
            p256dh: 'p256',
            auth: 'auth_secret',
          },
        ],
      });

      await service.sendAlertNotification(mockAlertData);

      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    it('若 Web Push 發送失敗且狀態碼為 410，應自動清除該訂閱資訊', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-123',
        telegramChatId: null,
        discordWebhook: null,
        webSubscriptions: [
          {
            id: 'sub-1',
            endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/endpoint123',
            p256dh: 'p256',
            auth: 'auth_secret',
          },
        ],
      });
      const error410 = { statusCode: 410, message: 'Subscription gone' };
      (webpush.sendNotification as jest.Mock).mockRejectedValue(error410);
      mockPrismaClient.webSubscription.delete.mockResolvedValue({});

      await service.sendAlertNotification(mockAlertData);

      expect(mockPrismaClient.webSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
      });
    });
  });

  describe('webSubscriptions CRUD', () => {
    it('subscribeWebPush 應調用 Prisma client upsert', async () => {
      const mockDto = {
        endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/endpoint123',
        p256dh: 'p256',
        auth: 'auth_secret',
      };
      mockPrismaClient.webSubscription.upsert.mockResolvedValue({ id: 'sub-1' });

      const result = await service.subscribeWebPush('user-123', mockDto);

      expect(mockPrismaClient.webSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: mockDto.endpoint },
        update: {
          p256dh: mockDto.p256dh,
          auth: mockDto.auth,
          userId: 'user-123',
        },
        create: {
          endpoint: mockDto.endpoint,
          p256dh: mockDto.p256dh,
          auth: mockDto.auth,
          userId: 'user-123',
        },
      });
      expect(result).toEqual({ id: 'sub-1' });
    });

    it('unsubscribeWebPush 應在訂閱存在時調用 delete', async () => {
      const mockDto = { endpoint: 'https://push.com/endpoint' };
      mockPrismaClient.webSubscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        endpoint: 'https://push.com/endpoint',
      });
      mockPrismaClient.webSubscription.delete.mockResolvedValue({});

      const result = await service.unsubscribeWebPush('user-123', mockDto);

      expect(mockPrismaClient.webSubscription.findFirst).toHaveBeenCalledWith({
        where: { endpoint: mockDto.endpoint, userId: 'user-123' },
      });
      expect(mockPrismaClient.webSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('unsubscribeWebPush 在訂閱不存在時，不應調用 delete 且回傳 success: false', async () => {
      const mockDto = { endpoint: 'https://push.com/endpoint' };
      mockPrismaClient.webSubscription.findFirst.mockResolvedValue(null);

      const result = await service.unsubscribeWebPush('user-123', mockDto);

      expect(mockPrismaClient.webSubscription.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false });
    });
  });
});
