import { OHLCVKline } from '../types';
import { normalizeCondition, scanSignals } from './indicator-evaluator';

export class EntryEvaluator {
  /**
   * 掃描單一時框區塊的所有 K 棒策略信號
   * @param klines K 線數據
   * @param block 包含篩選條件的時框區塊
   * @returns boolean[] 表示每根 K 棒是否滿足所有條件 (AND 邏輯)
   */
  static scanTimeframeBlockSignals(
    klines: OHLCVKline[],
    block: { conditions: any[] },
  ): boolean[] {
    const isSignalActive = Array(klines.length).fill(true);
    for (const cond of block.conditions) {
      const norm = normalizeCondition(cond);
      const activeIndices = scanSignals(klines, norm);

      const activeSet = new Set(activeIndices);
      for (let i = 0; i < klines.length; i++) {
        if (!activeSet.has(i)) {
          isSignalActive[i] = false;
        }
      }
    }
    return isSignalActive;
  }

  /**
   * 掃描反向平倉訊號 (例如主條件運算子翻轉：gt 變 lt，即均線死叉)
   */
  static scanReverseSignals(
    klines: OHLCVKline[],
    block: { conditions: any[] },
  ): boolean[] {
    if (!block.conditions || block.conditions.length === 0) {
      return Array(klines.length).fill(false);
    }
    const primary = block.conditions[0];
    const reversedCond = {
      ...primary,
      operator: primary.operator === 'gt' ? 'lt' : 'gt',
    };
    const norm = normalizeCondition(reversedCond);
    const activeIndices = scanSignals(klines, norm);
    const isReverse = Array(klines.length).fill(false);
    for (const idx of activeIndices) {
      isReverse[idx] = true;
    }
    return isReverse;
  }
}
