import { Test, TestingModule } from '@nestjs/testing';
import { NotificationProcessor } from './notification.processor';
import { NotificationsService } from './notifications.service';
import { Job } from 'bullmq';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let mockNotificationsService: any;

  beforeEach(async () => {
    mockNotificationsService = {
      sendAlertNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('NotificationProcessor 應該被成功載入', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('應處理 "send-notification" 任務並調用 NotificationsService.sendAlertNotification', async () => {
      const mockJob = {
        id: 'job-1',
        name: 'send-notification',
        data: {
          alertId: 'alert-1',
          userId: 'user-123',
          symbol: 'BTCUSDT',
          condition: 'ABOVE',
          targetPrice: 60000,
          triggeredPrice: 61000,
        },
      } as Job;

      await processor.process(mockJob);

      expect(mockNotificationsService.sendAlertNotification).toHaveBeenCalledWith({
        userId: 'user-123',
        symbol: 'BTCUSDT',
        condition: 'ABOVE',
        targetPrice: 60000,
        triggeredPrice: 61000,
      });
    });

    it('若為未知任務類型，應跳過調用並記錄警告', async () => {
      const mockJob = {
        id: 'job-1',
        name: 'unknown-job-type',
        data: {},
      } as Job;

      await processor.process(mockJob);

      expect(mockNotificationsService.sendAlertNotification).not.toHaveBeenCalled();
    });

    it('若 NotificationsService 拋出錯誤，處理器應將錯誤向外拋出以利 BullMQ 重試', async () => {
      const mockJob = {
        id: 'job-1',
        name: 'send-notification',
        data: {
          alertId: 'alert-1',
          userId: 'user-123',
          symbol: 'BTCUSDT',
          condition: 'ABOVE',
          targetPrice: 60000,
          triggeredPrice: 61000,
        },
      } as Job;

      const mockError = new Error('External API Error');
      mockNotificationsService.sendAlertNotification.mockRejectedValue(mockError);

      await expect(processor.process(mockJob)).rejects.toThrow('External API Error');
    });
  });
});
