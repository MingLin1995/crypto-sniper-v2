/**
 * 將 Higher Timeframe 的指標序列/值對齊到主時框 K 線序列上，防止 Look-Ahead Bias。
 * 對齊規則：僅當 Higher TF K 棒之 closeTime <= 主時框 K 棒之 closeTime 時才可引用該 Higher TF 值。
 * 
 * @param mainKlines 主時框 K 線陣列
 * @param higherKlines 更高時框 K 線陣列
 * @param higherValues 更高時框對應的指標值序列（長度必須與 higherKlines 相同）
 */
export function alignMultiTimeframe<T>(
  mainKlines: { closeTime: number }[],
  higherKlines: { closeTime: number }[],
  higherValues: T[],
): (T | null)[] {
  if (higherKlines.length !== higherValues.length) {
    throw new Error('Higher timeframe klines and values length mismatch');
  }

  const aligned: (T | null)[] = [];
  let higherIdx = 0;

  for (let i = 0; i < mainKlines.length; i++) {
    const mainCloseTime = mainKlines[i].closeTime;

    // 尋找最後一個完全收盤時間小於等於當前主時框 K 棒收盤時間的 Higher TF K 棒
    while (
      higherIdx + 1 < higherKlines.length &&
      higherKlines[higherIdx + 1].closeTime <= mainCloseTime
    ) {
      higherIdx++;
    }

    // 檢查當前選定的 Higher TF K 棒是否符合收盤時間限制
    if (
      higherIdx < higherKlines.length &&
      higherKlines[higherIdx].closeTime <= mainCloseTime
    ) {
      aligned.push(higherValues[higherIdx]);
    } else {
      aligned.push(null); // 還沒有任何 Higher TF K 棒完全收盤
    }
  }

  return aligned;
}
