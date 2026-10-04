import { Test, TestingModule } from '@nestjs/testing';
import { HistoricalKlineService } from './historical-kline.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { BinanceService } from './binance.service';

describe('HistoricalKlineService (歷史K線服務)', () => {
  let service: HistoricalKlineService;
  let mockPrisma: any;
  let mockBinanceService: any;

  beforeEach(async () => {
    mockPrisma = {
      historicalKline: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
        createMany: jest.fn(),
        count: jest.fn(),
      },
    };

    mockBinanceService = {
      getKlinesOHLCVPaginated: jest.fn(),
      getKlinesOHLCV: jest.fn().mockResolvedValue([{ openTime: 0 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoricalKlineService,
        { provide: ExtendedPrismaService, useValue: mockPrisma },
        { provide: BinanceService, useValue: mockBinanceService },
      ],
    }).compile();

    service = module.get<HistoricalKlineService>(HistoricalKlineService);
  });

  it('服務應該要被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('ensureKlines', () => {
    it('若資料已 100% 覆蓋，應直接返回且不呼叫 Binance API', async () => {
      mockPrisma.historicalKline.aggregate.mockResolvedValue({
        _count: 2,
        _min: { openTime: BigInt(10000000) },
        _max: { openTime: BigInt(13600000) },
      });

      // 1h = 3600000ms. [10000000, 13600000] contains exactly 2 expected hourly bars
      await service.ensureKlines('BTCUSDT', '1h', 10000000, 13600000);

      expect(mockBinanceService.getKlinesOHLCVPaginated).not.toHaveBeenCalled();
    });

    it('若資料庫完全無資料，應完整拉取並寫入資料庫', async () => {
      mockPrisma.historicalKline.aggregate.mockResolvedValue({
        _count: 0,
        _min: null,
        _max: null,
      });
      mockPrisma.historicalKline.findMany.mockResolvedValue([]);

      const mockKlines = [
        { openTime: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100, closeTime: 1999 },
      ];
      mockBinanceService.getKlinesOHLCVPaginated.mockResolvedValue(mockKlines);
      mockPrisma.historicalKline.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.historicalKline.count.mockResolvedValue(1);

      await service.ensureKlines('BTCUSDT', '1h', 1000, 2000);

      expect(mockBinanceService.getKlinesOHLCVPaginated).toHaveBeenCalledWith('BTCUSDT', '1h', 1000, 2000);
      expect(mockPrisma.historicalKline.createMany).toHaveBeenCalledWith({
        data: [
          {
            symbol: 'BTCUSDT',
            interval: '1h',
            openTime: BigInt(1000),
            open: '10',
            high: '12',
            low: '9',
            close: '11',
            volume: '100',
          },
        ],
        skipDuplicates: true,
      });
    });

    it('若資料庫僅有頭尾缺口（中間連續），應拉取前後缺口並補齊', async () => {
      mockPrisma.historicalKline.aggregate.mockResolvedValue({
        _count: 2,
        _min: { openTime: BigInt(20000000) },
        _max: { openTime: BigInt(23600000) },
      });

      // DB mock return contiguous rows: 20000000, 23600000
      mockPrisma.historicalKline.findMany.mockResolvedValue([
        { openTime: BigInt(20000000) },
        { openTime: BigInt(23600000) },
      ]);

      mockBinanceService.getKlinesOHLCVPaginated
        .mockResolvedValueOnce([{ openTime: 10000000, open: 10, high: 11, low: 9, close: 10, volume: 50, closeTime: 19999999 }])
        .mockResolvedValueOnce([{ openTime: 27200000, open: 12, high: 13, low: 11, close: 12, volume: 60, closeTime: 30800000 }]);

      mockPrisma.historicalKline.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.historicalKline.count.mockResolvedValue(4);

      // Start: 10000000, End: 27200000. interval: 1h (3600000). 
      // Existing in DB: 20000000, 23600000 (No intermediate gap since 23600000 - 20000000 = 3600000)
      // Front gap: [10000000, 19999999]
      // End gap: [27200000, 27200000]
      await service.ensureKlines('BTCUSDT', '1h', 10000000, 27200000);

      expect(mockBinanceService.getKlinesOHLCVPaginated).toHaveBeenNthCalledWith(1, 'BTCUSDT', '1h', 10000000, 19999999);
      expect(mockBinanceService.getKlinesOHLCVPaginated).toHaveBeenNthCalledWith(2, 'BTCUSDT', '1h', 27200000, 27200000);
    });

    it('若資料庫有中間缺口，應能正確偵測並拉取中間缺口與前後缺口', async () => {
      mockPrisma.historicalKline.aggregate.mockResolvedValue({
        _count: 2,
        _min: { openTime: BigInt(20000000) },
        _max: { openTime: BigInt(30000000) },
      });

      // DB mock return rows with intermediate gap: 20000000, 30000000 (Gap of 10000000ms, which is > 1.5 * 1h)
      mockPrisma.historicalKline.findMany.mockResolvedValue([
        { openTime: BigInt(20000000) },
        { openTime: BigInt(30000000) },
      ]);

      mockBinanceService.getKlinesOHLCVPaginated
        .mockResolvedValueOnce([{ openTime: 10000000, open: 10, high: 11, low: 9, close: 10, volume: 50 }]) // Front gap
        .mockResolvedValueOnce([{ openTime: 23600000, open: 10, high: 11, low: 9, close: 10, volume: 50 }]) // Middle gap
        .mockResolvedValueOnce([{ openTime: 33600000, open: 10, high: 11, low: 9, close: 10, volume: 50 }]); // End gap

      mockPrisma.historicalKline.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.historicalKline.count.mockResolvedValue(5);

      // Start: 10000000, End: 33600000. interval: 1h (3600000).
      // Front gap: [10000000, 19999999]
      // Middle gap: [23600000, 29999999]
      // End gap: [33600000, 33600000]
      await service.ensureKlines('BTCUSDT', '1h', 10000000, 33600000);

      expect(mockBinanceService.getKlinesOHLCVPaginated).toHaveBeenNthCalledWith(1, 'BTCUSDT', '1h', 10000000, 19999999);
      expect(mockBinanceService.getKlinesOHLCVPaginated).toHaveBeenNthCalledWith(2, 'BTCUSDT', '1h', 23600000, 29999999);
      expect(mockBinanceService.getKlinesOHLCVPaginated).toHaveBeenNthCalledWith(3, 'BTCUSDT', '1h', 33600000, 33600000);
    });
  });

  describe('getKlinesFromDb', () => {
    it('應能從資料庫拉取資料並正確轉換型別映射為 OHLCVKline[]', async () => {
      const mockRows = [
        {
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: BigInt(1000),
          open: '10.5',
          high: '12.0',
          low: '9.0',
          close: '11.0',
          volume: '150.0',
        },
      ];
      mockPrisma.historicalKline.findMany.mockResolvedValue(mockRows);

      const result = await service.getKlinesFromDb('BTCUSDT', '1h', 1000, 5000);

      expect(mockPrisma.historicalKline.findMany).toHaveBeenCalledWith({
        where: {
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: { gte: BigInt(1000), lte: BigInt(5000) },
        },
        orderBy: { openTime: 'asc' },
      });
      expect(result).toEqual([
        {
          openTime: 1000,
          open: 10.5,
          high: 12,
          low: 9,
          close: 11,
          volume: 150,
          closeTime: 1000 + 3600000 - 1,
        },
      ]);
    });
  });
});
