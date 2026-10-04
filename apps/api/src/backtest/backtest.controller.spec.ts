import { Test, TestingModule } from '@nestjs/testing';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';

describe('BacktestController (量化回測控制器)', () => {
  let controller: BacktestController;
  let backtestService: jest.Mocked<BacktestService>;

  const mockReq = {
    user: { sub: 'user-123' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BacktestController],
      providers: [
        {
          provide: BacktestService,
          useValue: {
            createJob: jest.fn(),
            getHistory: jest.fn(),
            getJob: jest.fn(),
            deleteJob: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BacktestController>(BacktestController);
    backtestService = module.get(BacktestService);
  });

  describe('create (發起回測任務)', () => {
    it('應呼叫 backtestService.createJob 並回傳任務狀態', async () => {
      const dto: any = { symbols: ['BTCUSDT'], interval: '1h' };
      const expectedJob = { id: 'job-1', status: 'PENDING' };
      backtestService.createJob.mockResolvedValue(expectedJob as any);

      const result = await controller.create(mockReq, dto);

      expect(backtestService.createJob).toHaveBeenCalledWith('user-123', dto);
      expect(result).toEqual(expectedJob);
    });
  });

  describe('getHistory (查詢歷史回測紀錄)', () => {
    it('應正確解析分頁參數並呼叫 backtestService.getHistory', async () => {
      const expectedHistory = { data: [], total: 0 };
      backtestService.getHistory.mockResolvedValue(expectedHistory as any);

      const result = await controller.getHistory(mockReq, '2', '20');

      expect(backtestService.getHistory).toHaveBeenCalledWith('user-123', 2, 20);
      expect(result).toEqual(expectedHistory);
    });

    it('分頁參數未提供或無效時應套用預設值 (page=1, limit=10)', async () => {
      backtestService.getHistory.mockResolvedValue({ data: [] } as any);

      await controller.getHistory(mockReq, undefined, undefined);

      expect(backtestService.getHistory).toHaveBeenCalledWith('user-123', 1, 10);
    });
  });

  describe('getJob (查詢單一任務詳情)', () => {
    it('應呼叫 backtestService.getJob', async () => {
      const expectedJob = { id: 'job-123', status: 'COMPLETED' };
      backtestService.getJob.mockResolvedValue(expectedJob as any);

      const result = await controller.getJob(mockReq, 'job-123');

      expect(backtestService.getJob).toHaveBeenCalledWith('user-123', 'job-123');
      expect(result).toEqual(expectedJob);
    });
  });

  describe('deleteJob (刪除歷史任務)', () => {
    it('應呼叫 backtestService.deleteJob', async () => {
      backtestService.deleteJob.mockResolvedValue({ message: 'Deleted' } as any);

      const result = await controller.deleteJob(mockReq, 'job-123');

      expect(backtestService.deleteJob).toHaveBeenCalledWith('user-123', 'job-123');
      expect(result).toEqual({ message: 'Deleted' });
    });
  });
});
