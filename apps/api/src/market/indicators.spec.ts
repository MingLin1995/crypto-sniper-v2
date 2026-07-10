import { calculateSMA, calculateEMA, calculateRSI, calculateMACD } from './indicators';

describe('Indicators calculations', () => {
  describe('calculateSMA', () => {
    it('should calculate SMA correctly', () => {
      const prices = [10, 20, 30, 40, 50];
      const period = 3;
      const result = calculateSMA(prices, period);

      expect(result.length).toBe(5);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      // (10 + 20 + 30) / 3 = 20
      expect(result[2]).toBeCloseTo(20);
      // (20 + 30 + 40) / 3 = 30
      expect(result[3]).toBeCloseTo(30);
      // (30 + 40 + 50) / 3 = 40
      expect(result[4]).toBeCloseTo(40);
    });

    it('should return nulls if prices length is less than period', () => {
      const prices = [10, 20];
      const period = 5;
      const result = calculateSMA(prices, period);

      expect(result).toEqual([null, null]);
    });

    it('should return nulls if period is 0 or negative', () => {
      const prices = [10, 20, 30];
      expect(calculateSMA(prices, 0)).toEqual([null, null, null]);
      expect(calculateSMA(prices, -1)).toEqual([null, null, null]);
    });
  });

  describe('calculateEMA', () => {
    it('should calculate EMA correctly using first SMA as seed', () => {
      const prices = [10, 20, 30, 40];
      const period = 3;
      const result = calculateEMA(prices, period);

      expect(result.length).toBe(4);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      
      // EMA_2 = SMA(10, 20, 30) = 20
      expect(result[2]).toBeCloseTo(20);

      // multiplier k = 2 / (3 + 1) = 0.5
      // EMA_3 = 40 * 0.5 + 20 * (1 - 0.5) = 20 + 10 = 30
      expect(result[3]).toBeCloseTo(30);
    });

    it('should return nulls if prices length is less than period', () => {
      const prices = [10, 20];
      const period = 5;
      const result = calculateEMA(prices, period);

      expect(result).toEqual([null, null]);
    });

    it('should return nulls if period is 0 or negative', () => {
      const prices = [10, 20, 30];
      expect(calculateEMA(prices, 0)).toEqual([null, null, null]);
      expect(calculateEMA(prices, -1)).toEqual([null, null, null]);
    });
  });

  describe('calculateRSI', () => {
    it('should calculate RSI correctly', () => {
      // Create a series of price increases
      const prices = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38]; // 15 elements, 14 changes
      const period = 14;
      const result = calculateRSI(prices, period);

      expect(result.length).toBe(15);
      expect(result[0]).toBeNull();
      expect(result[13]).toBeNull();
      // All changes are +2, so Gain is 2, Loss is 0. RSI should be 100
      expect(result[14]).toBeCloseTo(100);
    });

    it('should return nulls if prices length is less than or equal to period', () => {
      const prices = [10, 20];
      const period = 2;
      const result = calculateRSI(prices, period);

      expect(result).toEqual([null, null]);
    });
  });

  describe('calculateMACD', () => {
    it('should calculate MACD elements correctly', () => {
      // standard inputs
      const prices = Array(35).fill(100).map((val, idx) => val + idx); // linear uptrend
      const result = calculateMACD(prices, 12, 26, 9);

      expect(result.macd.length).toBe(35);
      expect(result.signal.length).toBe(35);
      expect(result.histogram.length).toBe(35);

      // check leading nulls
      expect(result.macd[24]).toBeNull();
      expect(result.macd[25]).not.toBeNull(); // EMA26 is populated on index 25 (26th element)
      
      // signal starts at first valid macd idx (25) + signalPeriod (9) - 1 = 33
      expect(result.signal[32]).toBeNull();
      expect(result.signal[33]).not.toBeNull();
      expect(result.histogram[33]).not.toBeNull();
    });
  });
});
