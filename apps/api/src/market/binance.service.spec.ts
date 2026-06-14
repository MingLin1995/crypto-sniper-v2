import { Test, TestingModule } from '@nestjs/testing';
import { BinanceService } from './binance.service';
import axios from 'axios';

describe('BinanceService (幣安行情服務)', () => {
  let service: BinanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BinanceService],
    }).compile();

    service = module.get<BinanceService>(BinanceService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('服務應該要被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('getUSDTFuturesSymbols (獲取可用 USDT 合約交易對清單)', () => {
    it('應能成功獲取並過濾出活躍的 USDT 永續合約交易對', async () => {
      const mockExchangeInfo = {
        symbols: [
          { symbol: 'BTCUSDT', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' },
          { symbol: 'ETHUSDT', quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' },
          { symbol: 'XRPBTC', quoteAsset: 'BTC', status: 'TRADING', contractType: 'PERPETUAL' },
          { symbol: 'LTCUSDT', quoteAsset: 'USDT', status: 'BREAK', contractType: 'PERPETUAL' },
          { symbol: 'SOLUSDT', quoteAsset: 'USDT', status: 'TRADING', contractType: 'DELIVERY' },
        ],
      };
      const getSpy = jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: mockExchangeInfo });

      const result = await service.getUSDTFuturesSymbols();
      expect(getSpy).toHaveBeenCalledWith('https://fapi.binance.com/fapi/v1/exchangeInfo');
      expect(result).toEqual(['BTCUSDT', 'ETHUSDT']);
    });

    it('當請求失敗時，應拋出錯誤', async () => {
      jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Network error'));
      await expect(service.getUSDTFuturesSymbols()).rejects.toThrow('Network error');
    });
  });

  describe('getKlines (獲取歷史 K 線收盤價)', () => {
    it('應能成功獲取 K 線並回傳數值型態的收盤價陣列', async () => {
      const mockKlines = [
        [1625097600000, '34000.00', '35000.00', '33000.00', '34500.50', '1000.00', 1625101199999, '34500000.00', 500, '500.00', '17250000.00', '0'],
        [1625101200000, '34500.50', '36000.00', '34000.00', '35200.75', '1200.00', 1625104799999, '42240900.00', 600, '600.00', '21120450.00', '0'],
      ];
      const getSpy = jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: mockKlines });

      const result = await service.getKlines('BTCUSDT', '1h', 2);
      expect(getSpy).toHaveBeenCalledWith('https://fapi.binance.com/fapi/v1/klines', {
        params: {
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: 2,
        },
      });
      expect(result).toEqual([34500.5, 35200.75]);
    });

    it('當請求失敗時，應拋出錯誤', async () => {
      jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('API rate limit'));
      await expect(service.getKlines('BTCUSDT', '1h')).rejects.toThrow('API rate limit');
    });
  });

  describe('getTickerPrices (獲取全市場最新成交價)', () => {
    it('應能成功獲取全市場成交價並回傳解析與過濾後的 USDT 交易對數值陣列', async () => {
      const mockTickers = [
        { symbol: 'BTCUSDT', price: '60000.50' },
        { symbol: 'ETHUSDT', price: '3000.25' },
        { symbol: 'XRPBUSD', price: '0.50' },
      ];
      const getSpy = jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: mockTickers });

      const result = await service.getTickerPrices();
      expect(getSpy).toHaveBeenCalledWith('https://fapi.binance.com/fapi/v1/ticker/price');
      expect(result).toEqual([
        { symbol: 'BTCUSDT', price: 60000.5 },
        { symbol: 'ETHUSDT', price: 3000.25 },
      ]);
    });

    it('當請求失敗時，應拋出錯誤', async () => {
      jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Fetch error'));
      await expect(service.getTickerPrices()).rejects.toThrow('Fetch error');
    });
  });

  describe('get24hVolumeRanking (獲取 24h 交易量排行)', () => {
    it('應能成功獲取 24h 行情，過濾出 USDT 交易對，解析 quoteVolume 並按交易量降冪排序', async () => {
      const mock24hTickers = [
        { symbol: 'BTCUSDT', quoteVolume: '100000.00' },
        { symbol: 'ETHUSDT', quoteVolume: '500000.00' },
        { symbol: 'SOLUSDT', quoteVolume: '300000.00' },
        { symbol: 'XRPBUSD', quoteVolume: '800000.00' }, // 應被過濾，因為不是以 USDT 結尾
      ];
      const getSpy = jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: mock24hTickers });

      const result = await service.get24hVolumeRanking();
      expect(getSpy).toHaveBeenCalledWith('https://fapi.binance.com/fapi/v1/ticker/24hr');
      expect(result).toEqual([
        { symbol: 'ETHUSDT', quoteVolume: 500000 },
        { symbol: 'SOLUSDT', quoteVolume: 300000 },
        { symbol: 'BTCUSDT', quoteVolume: 100000 },
      ]);
    });

    it('當請求失敗時，應拋出錯誤', async () => {
      jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('API error'));
      await expect(service.get24hVolumeRanking()).rejects.toThrow('API error');
    });
  });
});
