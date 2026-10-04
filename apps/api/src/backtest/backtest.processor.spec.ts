import { Test, TestingModule } from '@nestjs/testing';
import { BacktestProcessor } from './backtest.processor';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { HistoricalKlineService } from '../market/historical-kline.service';
import { BacktestEngine } from './engine/backtest-engine';
import { Job } from 'bullmq';

describe('BacktestProcessor (佇列任務處理器)', () => {
  let processor: BacktestProcessor;
  let mockPrisma: any;
  let mockHistoricalKlineService: any;

  beforeEach(async () => {
    mockPrisma = {
      client: {
        backtestJob: {
          update: jest.fn(),
          findUniqueOrThrow: jest.fn(),
        },
      },
    };

    mockHistoricalKlineService = {
      ensureKlines: jest.fn(),
      getKlinesFromDb: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacktestProcessor,
        { provide: ExtendedPrismaService, useValue: mockPrisma },
        { provide: HistoricalKlineService, useValue: mockHistoricalKlineService },
      ],
    }).compile();

    processor = module.get<BacktestProcessor>(BacktestProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('處理器應該要被成功載入', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('應能完成完整的歷史資料獲取、回測執行與結果儲存生命週期', async () => {
      const mockJobId = 'job-123';
      const mockConfig = {
        symbols: ['BTCUSDT'],
        interval: '15m',
        startTime: 1000,
        endTime: 5000,
        leverage: 10,
        tpPercent: 5,
        slPercent: 2,
        initialBalance: 10000,
        fundingRate: 0.0001,
        positionSizingMode: 'FIXED_PERCENT',
        timeframes: [
          {
            interval: '15m',
            conditions: [],
          },
        ],
      };

      mockPrisma.client.backtestJob.findUniqueOrThrow.mockResolvedValue({
        id: mockJobId,
        config: mockConfig,
      });

      mockHistoricalKlineService.getKlinesFromDb.mockResolvedValue([
        { openTime: 1000, open: 100, high: 101, low: 99, close: 100, volume: 10, closeTime: 1999 },
      ]);

      const mockEngineResult = {
        state: {
          stats: { roi: 0.1 },
          trades: [],
          equityCurve: [],
        },
        warnings: [],
      };

      const engineRunSpy = jest.spyOn(BacktestEngine, 'run').mockReturnValue(mockEngineResult as any);

      const mockJob = {
        data: { jobId: mockJobId },
      } as Job;

      await processor.process(mockJob);

      // 驗證流程 1: 將狀態更新為 RUNNING
      expect(mockPrisma.client.backtestJob.update).toHaveBeenNthCalledWith(1, {
        where: { id: mockJobId },
        data: {
          status: 'RUNNING',
          startedAt: expect.any(Date),
        },
      });

      // 驗證流程 2: 同步 K 線
      expect(mockHistoricalKlineService.ensureKlines).toHaveBeenCalledWith('BTCUSDT', '15m', 1000, 5000);
      expect(mockHistoricalKlineService.getKlinesFromDb).toHaveBeenCalledWith('BTCUSDT', '15m', 1000, 5000);

      // 驗證流程 3: 執行回測引擎
      expect(engineRunSpy).toHaveBeenCalled();

      // 驗證流程 4: 儲存結果並更新狀態為 COMPLETED
      expect(mockPrisma.client.backtestJob.update).toHaveBeenNthCalledWith(2, {
        where: { id: mockJobId },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          result: {
            stats: mockEngineResult.state.stats,
            trades: mockEngineResult.state.trades,
            equityCurve: mockEngineResult.state.equityCurve,
            warnings: mockEngineResult.warnings,
          },
        },
      });
    });

    it('若執行出錯，應將狀態更新為 FAILED 並寫入錯誤訊息', async () => {
      const mockJobId = 'job-456';
      mockPrisma.client.backtestJob.findUniqueOrThrow.mockRejectedValue(new Error('DB Connection Timeout'));

      const mockJob = {
        data: { jobId: mockJobId },
      } as Job;

      await processor.process(mockJob);

      // 驗證將狀態更新為 FAILED 且記錄了錯誤
      expect(mockPrisma.client.backtestJob.update).toHaveBeenCalledWith({
        where: { id: mockJobId },
        data: {
          status: 'FAILED',
          completedAt: expect.any(Date),
          error: 'DB Connection Timeout',
        },
      });
    });
  });
});
