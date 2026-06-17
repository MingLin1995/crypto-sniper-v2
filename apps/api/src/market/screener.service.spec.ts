import { Test, TestingModule } from '@nestjs/testing';
import { ScreenerService } from './screener.service';
import { MarketCacheService } from './market-cache.service';
import { BinanceService } from './binance.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('ScreenerService', () => {
  let service: ScreenerService;
  let mockBinanceService: any;
  let mockMarketCacheService: any;

  beforeEach(async () => {
    mockBinanceService = {
      getUSDTFuturesSymbols: jest.fn(),
      getKlines: jest.fn(),
    };

    mockMarketCacheService = {
      getScreenerResult: jest.fn(),
      setScreenerResult: jest.fn(),
      getKlines: jest.fn(),
      setKlines: jest.fn(),
      getVolumeRanking: jest.fn(),
      getPrice: jest.fn(),
      getPrices: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreenerService,
        {
          provide: BinanceService,
          useValue: mockBinanceService,
        },
        {
          provide: MarketCacheService,
          useValue: mockMarketCacheService,
        },
      ],
    }).compile();

    service = module.get<ScreenerService>(ScreenerService);
    jest.clearAllMocks();
  });

  it('ScreenerService 應該被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('screen', () => {
    const mockRequest = {
      timeframes: [
        {
          interval: '15m',
          conditions: [
            {
              ma1Type: 'EMA' as const,
              ma1Period: 5,
              operator: 'gt' as const,
              ma2Type: 'EMA' as const,
              ma2Period: 10,
            },
          ],
        },
      ],
    };

    it('如果快取覆蓋率小於 10%，應拋出 ServiceUnavailableException (預熱中)', async () => {
      mockMarketCacheService.getScreenerResult.mockResolvedValue(null);
      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      // 模擬全部快取缺失
      mockMarketCacheService.getKlines.mockResolvedValue(null);

      await expect(service.screen(mockRequest)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('當快取存在時，應直接讀取快取並返回標的與對應價格/成交量', async () => {
      // 1. 模擬命中快取結果
      mockMarketCacheService.getScreenerResult.mockResolvedValue(['BTCUSDT']);
      mockMarketCacheService.getPrices.mockResolvedValue({ BTCUSDT: 65000 });
      mockMarketCacheService.getVolumeRanking.mockResolvedValue([
        { symbol: 'BTCUSDT', quoteVolume: 1500000 },
      ]);

      const result = await service.screen(mockRequest);

      expect(mockMarketCacheService.getScreenerResult).toHaveBeenCalled();
      expect(mockBinanceService.getUSDTFuturesSymbols).not.toHaveBeenCalled(); // 沒走篩選流程，直接拿快取
      expect(result).toEqual([
        {
          symbol: 'BTCUSDT',
          price: 65000,
          volume: 1500000,
        },
      ]);
    });

    it('應正確篩選符合條件的交易對並寫入 Redis 快取', async () => {
      mockMarketCacheService.getScreenerResult.mockResolvedValue(null); // 快取未命中
      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(['BTCUSDT', 'ETHUSDT']);
      
      // 取樣時快取必須命中（大於 10% 避免預熱警告）
      // 模擬 BTCUSDT 價格數值
      const btcKlines = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]; // 滿足 EMA5 > EMA10
      // 模擬 ETHUSDT 價格數值
      const ethKlines = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10]; // 不滿足 EMA5 > EMA10

      mockMarketCacheService.getKlines
        .mockImplementation(async (symbol: string) => {
          if (symbol === 'BTCUSDT') return btcKlines;
          if (symbol === 'ETHUSDT') return ethKlines;
          return null;
        });

      mockMarketCacheService.getPrices.mockResolvedValue({
        BTCUSDT: 20,
        ETHUSDT: 10,
      });

      mockMarketCacheService.getVolumeRanking.mockResolvedValue([
        { symbol: 'BTCUSDT', quoteVolume: 5000 },
        { symbol: 'ETHUSDT', quoteVolume: 3000 },
      ]);

      const result = await service.screen(mockRequest);

      // BTCUSDT 符合條件，ETHUSDT 不符合條件
      expect(result.length).toBe(1);
      expect(result[0].symbol).toBe('BTCUSDT');
      expect(result[0].price).toBe(20);
      expect(result[0].volume).toBe(5000);

      // 檢查結果是否有被寫入 Redis 快取
      expect(mockMarketCacheService.setScreenerResult).toHaveBeenCalled();
    });

    it('當時間週期條件為空時，應直接返回所有交易對並按成交量降冪排序', async () => {
      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      mockMarketCacheService.getPrices.mockResolvedValue({
        BTCUSDT: 65000,
        ETHUSDT: 3500,
        SOLUSDT: 150,
      });
      mockMarketCacheService.getVolumeRanking.mockResolvedValue([
        { symbol: 'SOLUSDT', quoteVolume: 3000000 },
        { symbol: 'BTCUSDT', quoteVolume: 10000000 },
        { symbol: 'ETHUSDT', quoteVolume: 5000000 },
      ]);

      const result = await service.screen({ timeframes: [] });

      expect(mockBinanceService.getUSDTFuturesSymbols).toHaveBeenCalled();
      expect(mockMarketCacheService.getPrices).toHaveBeenCalledWith(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      expect(result).toEqual([
        { symbol: 'BTCUSDT', price: 65000, volume: 10000000 },
        { symbol: 'ETHUSDT', price: 3500, volume: 5000000 },
        { symbol: 'SOLUSDT', price: 150, volume: 3000000 },
      ]);
    });
  });
});
