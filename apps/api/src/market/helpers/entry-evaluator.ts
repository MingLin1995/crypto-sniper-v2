import { OHLCVKline } from '../types';
import {
  extractClosePricesFloat64,
  normalizeCondition,
  scanSignalsMask,
} from './indicator-evaluator';

export class EntryEvaluator {
  /**
   * 掃描單一時框區塊的所有 K 棒策略信號，回傳緊湊 Uint8Array 遮罩 (1 = 符合所有條件)
   */
  static scanTimeframeBlockSignalsMask(
    klines: OHLCVKline[],
    block: { conditions: any[] },
    preExtractedCloses?: Float64Array,
  ): Uint8Array {
    const len = klines.length;
    const resultMask = new Uint8Array(len);
    if (len === 0) {
      return resultMask;
    }
    resultMask.fill(1);

    if (!block.conditions || block.conditions.length === 0) {
      return resultMask;
    }

    const closes = preExtractedCloses ?? extractClosePricesFloat64(klines);
    for (const cond of block.conditions) {
      const norm = normalizeCondition(cond);
      const condMask = scanSignalsMask(closes, norm);
      for (let i = 0; i < len; i++) {
        resultMask[i] &= condMask[i];
      }
    }
    return resultMask;
  }

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
    const mask = this.scanTimeframeBlockSignalsMask(klines, block);
    const out = new Array<boolean>(mask.length);
    for (let i = 0; i < mask.length; i++) {
      out[i] = mask[i] === 1;
    }
    return out;
  }

  /**
   * 掃描反向平倉訊號，回傳緊湊 Uint8Array 遮罩
   */
  static scanReverseSignalsMask(
    klines: OHLCVKline[],
    block: { conditions: any[] },
    preExtractedCloses?: Float64Array,
  ): Uint8Array {
    if (!block.conditions || block.conditions.length === 0) {
      return new Uint8Array(klines.length);
    }
    const primary = block.conditions[0];
    const reversedCond = {
      ...primary,
      operator: primary.operator === 'gt' ? 'lt' : 'gt',
    };
    const closes = preExtractedCloses ?? extractClosePricesFloat64(klines);
    return scanSignalsMask(closes, normalizeCondition(reversedCond));
  }

  /**
   * 掃描反向平倉訊號 (例如主條件運算子翻轉：gt 變 lt，即均線死叉)
   */
  static scanReverseSignals(
    klines: OHLCVKline[],
    block: { conditions: any[] },
  ): boolean[] {
    const mask = this.scanReverseSignalsMask(klines, block);
    const out = new Array<boolean>(mask.length);
    for (let i = 0; i < mask.length; i++) {
      out[i] = mask[i] === 1;
    }
    return out;
  }
}
