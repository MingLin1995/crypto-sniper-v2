import { alignMultiTimeframe } from './multi-timeframe-aligner';

describe('multi-timeframe-aligner (多時框歷史對齊)', () => {
  it('應能將 Higher TF 的指標值正確且不帶 Look-Ahead Bias 地對齊到主時框', () => {
    // 主時框 15m K 線結束時間
    const mainKlines = [
      { closeTime: 15 }, // m0
      { closeTime: 30 }, // m1
      { closeTime: 45 }, // m2
      { closeTime: 60 }, // m3
      { closeTime: 75 }, // m4
    ];

    // 更高時框 30m K 線結束時間
    const higherKlines = [
      { closeTime: 30 }, // h0
      { closeTime: 60 }, // h1
    ];

    const higherValues = ['val_30', 'val_60'];

    const result = alignMultiTimeframe(mainKlines, higherKlines, higherValues);

    expect(result).toEqual([
      null,       // m0: closeTime 15 < h0 closeTime 30 (未收盤) -> null
      'val_30',   // m1: closeTime 30 >= h0 closeTime 30 -> val_30
      'val_30',   // m2: closeTime 45 >= h0 closeTime 30, but < h1 closeTime 60 -> val_30
      'val_60',   // m3: closeTime 60 >= h1 closeTime 60 -> val_60
      'val_60',   // m4: closeTime 75 >= h1 closeTime 60 -> val_60
    ]);
  });

  it('若長度不匹配，應拋出錯誤', () => {
    expect(() => {
      alignMultiTimeframe([{ closeTime: 10 }], [{ closeTime: 20 }], []);
    }).toThrow('Higher timeframe klines and values length mismatch');
  });
});
