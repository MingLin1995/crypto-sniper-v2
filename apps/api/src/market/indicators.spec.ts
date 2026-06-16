import { calculateSMA, calculateEMA } from './indicators';

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
});
