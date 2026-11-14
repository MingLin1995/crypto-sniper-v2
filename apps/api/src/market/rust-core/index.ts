import { QUANT_CORE_WASM_BASE64 } from './quant-core-wasm.bytes';

interface QuantCoreWasmExports {
  memory: WebAssembly.Memory;
  alloc_f64: (len: number) => number;
  free_f64: (ptr: number, len: number) => void;
  alloc_u8: (len: number) => number;
  free_u8: (ptr: number, len: number) => void;
  calculate_sma_ffi: (pricesPtr: number, len: number, period: number, outPtr: number) => void;
  calculate_ema_ffi: (pricesPtr: number, len: number, period: number, outPtr: number) => void;
  calculate_rsi_ffi: (pricesPtr: number, len: number, period: number, outPtr: number) => void;
  calculate_macd_ffi: (
    pricesPtr: number,
    len: number,
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
    macdOutPtr: number,
    signalOutPtr: number,
    histOutPtr: number,
  ) => void;
  scan_signals_ffi: (
    series1Ptr: number,
    series2Ptr: number,
    len: number,
    compareMode: number,
    compareValue: number,
    operator: number,
    outMaskPtr: number,
  ) => number;
  align_multi_timeframe_u8_ffi: (
    mainClosePtr: number,
    mainLen: number,
    higherClosePtr: number,
    higherValsPtr: number,
    higherLen: number,
    outAlignedPtr: number,
  ) => void;
  calculate_equity_metrics_ffi: (
    equitiesPtr: number,
    len: number,
    initialBalance: number,
    annualizationFactor: number,
    outMetricsPtr: number,
  ) => void;
}

let wasmExports: QuantCoreWasmExports | null = null;
let wasmInitError: Error | null = null;

function initWasm(): QuantCoreWasmExports | null {
  if (wasmExports) {
    return wasmExports;
  }
  if (wasmInitError) {
    return null;
  }

  try {
    const raw = Buffer.from(QUANT_CORE_WASM_BASE64, 'base64');
    const bytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    const mod = new WebAssembly.Module(bytes);
    const instance = new WebAssembly.Instance(mod, {});
    wasmExports = instance.exports as unknown as QuantCoreWasmExports;
    return wasmExports;
  } catch (err) {
    wasmInitError = err instanceof Error ? err : new Error(String(err));
    return null;
  }
}

function getExportsOrThrow(): QuantCoreWasmExports {
  const exports = initWasm();
  if (!exports) {
    throw wasmInitError || new Error('Rust WASM quant_core module is not initialized');
  }
  return exports;
}

/**
 * Returns whether the embedded Rust WebAssembly quantitative core is loaded and active.
 */
export function isRustCoreActive(): boolean {
  return initWasm() !== null;
}

/**
 * Convert a Float64Array where `NaN` denotes missing/warm-up slots into `(number | null)[]`.
 */
export function float64ToNullableArray(arr: Float64Array): (number | null)[] {
  const result = new Array<number | null>(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const val = arr[i];
    result[i] = Number.isNaN(val) ? null : val;
  }
  return result;
}

/**
 * Normalize an arbitrary number[] or Float64Array input into a contiguous Float64Array.
 */
export function toFloat64Array(prices: Float64Array | readonly number[]): Float64Array {
  return prices instanceof Float64Array ? prices : Float64Array.from(prices);
}

function runSingleSeriesIndicator(
  pricesInput: Float64Array | readonly number[],
  period: number,
  compute: (exports: QuantCoreWasmExports, inPtr: number, len: number, period: number, outPtr: number) => void,
): Float64Array {
  const len = pricesInput.length;
  if (len === 0) {
    return new Float64Array(0);
  }
  if (period <= 0) {
    const nanArr = new Float64Array(len);
    nanArr.fill(Number.NaN);
    return nanArr;
  }

  const exports = getExportsOrThrow();
  const prices = toFloat64Array(pricesInput);

  // Allocate all WASM buffers before creating TypedArray views so memory.grow() never detaches views.
  const inPtr = exports.alloc_f64(len);
  const outPtr = exports.alloc_f64(len);

  try {
    new Float64Array(exports.memory.buffer, inPtr, len).set(prices);
    compute(exports, inPtr, len, Math.trunc(period), outPtr);
    // Re-create view after WASM call in case linear memory grew during execution.
    return new Float64Array(exports.memory.buffer, outPtr, len).slice();
  } finally {
    exports.free_f64(inPtr, len);
    exports.free_f64(outPtr, len);
  }
}

/**
 * Calculate Simple Moving Average (SMA) in Rust WASM linear memory.
 */
export function calculateSMAFloat64(
  prices: Float64Array | readonly number[],
  period: number,
): Float64Array {
  return runSingleSeriesIndicator(prices, period, (exp, inPtr, len, p, outPtr) =>
    exp.calculate_sma_ffi(inPtr, len, p, outPtr),
  );
}

/**
 * Calculate Exponential Moving Average (EMA) in Rust WASM linear memory.
 */
export function calculateEMAFloat64(
  prices: Float64Array | readonly number[],
  period: number,
): Float64Array {
  return runSingleSeriesIndicator(prices, period, (exp, inPtr, len, p, outPtr) =>
    exp.calculate_ema_ffi(inPtr, len, p, outPtr),
  );
}

/**
 * Calculate Relative Strength Index (RSI) in Rust WASM linear memory.
 */
export function calculateRSIFloat64(
  prices: Float64Array | readonly number[],
  period: number,
): Float64Array {
  return runSingleSeriesIndicator(prices, period, (exp, inPtr, len, p, outPtr) =>
    exp.calculate_rsi_ffi(inPtr, len, p, outPtr),
  );
}

/**
 * Calculate MACD, Signal, and Histogram series in Rust WASM linear memory.
 */
export function calculateMACDFloat64(
  pricesInput: Float64Array | readonly number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: Float64Array; signal: Float64Array; histogram: Float64Array } {
  const len = pricesInput.length;
  if (len === 0) {
    return {
      macd: new Float64Array(0),
      signal: new Float64Array(0),
      histogram: new Float64Array(0),
    };
  }
  if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0 || len < slowPeriod) {
    const empty = () => {
      const a = new Float64Array(len);
      a.fill(Number.NaN);
      return a;
    };
    return { macd: empty(), signal: empty(), histogram: empty() };
  }

  const exports = getExportsOrThrow();
  const prices = toFloat64Array(pricesInput);

  const inPtr = exports.alloc_f64(len);
  const macdPtr = exports.alloc_f64(len);
  const signalPtr = exports.alloc_f64(len);
  const histPtr = exports.alloc_f64(len);

  try {
    new Float64Array(exports.memory.buffer, inPtr, len).set(prices);
    exports.calculate_macd_ffi(
      inPtr,
      len,
      Math.trunc(fastPeriod),
      Math.trunc(slowPeriod),
      Math.trunc(signalPeriod),
      macdPtr,
      signalPtr,
      histPtr,
    );

    return {
      macd: new Float64Array(exports.memory.buffer, macdPtr, len).slice(),
      signal: new Float64Array(exports.memory.buffer, signalPtr, len).slice(),
      histogram: new Float64Array(exports.memory.buffer, histPtr, len).slice(),
    };
  } finally {
    exports.free_f64(inPtr, len);
    exports.free_f64(macdPtr, len);
    exports.free_f64(signalPtr, len);
    exports.free_f64(histPtr, len);
  }
}

/**
 * Vectorized condition scan returning a Uint8Array mask (1 = matched, 0 = not matched).
 */
export function scanConditionMask(
  series1: Float64Array,
  series2: Float64Array | null,
  compareType: 'indicator' | 'value',
  compareValue: number,
  operator: 'gt' | 'lt',
): Uint8Array {
  const len = series1.length;
  if (len === 0) {
    return new Uint8Array(0);
  }

  const exports = getExportsOrThrow();
  const compareMode = compareType === 'value' ? 1 : 0;
  const opCode = operator === 'gt' ? 0 : operator === 'lt' ? 1 : 255;

  if (compareMode === 0 && (!series2 || series2.length !== len)) {
    return new Uint8Array(len);
  }

  const s1Ptr = exports.alloc_f64(len);
  const s2Ptr = compareMode === 0 ? exports.alloc_f64(len) : 0;
  const maskPtr = exports.alloc_u8(len);

  try {
    new Float64Array(exports.memory.buffer, s1Ptr, len).set(series1);
    if (compareMode === 0 && series2) {
      new Float64Array(exports.memory.buffer, s2Ptr, len).set(series2);
    }

    exports.scan_signals_ffi(
      s1Ptr,
      s2Ptr,
      len,
      compareMode,
      compareValue,
      opCode,
      maskPtr,
    );

    return new Uint8Array(exports.memory.buffer, maskPtr, len).slice();
  } finally {
    exports.free_f64(s1Ptr, len);
    if (s2Ptr !== 0) {
      exports.free_f64(s2Ptr, len);
    }
    exports.free_u8(maskPtr, len);
  }
}

/**
 * Align a higher-timeframe u8 signal mask onto main-timeframe bars without look-ahead bias.
 * Returns a Uint8Array of length `mainCloseTimes.length` where `255` indicates no closed higher bar.
 */
export function alignMultiTimeframeMask(
  mainCloseTimes: Float64Array,
  higherCloseTimes: Float64Array,
  higherMask: Uint8Array,
): Uint8Array {
  const mainLen = mainCloseTimes.length;
  const higherLen = higherCloseTimes.length;
  if (higherLen !== higherMask.length) {
    throw new Error('Higher timeframe klines and values length mismatch');
  }
  if (mainLen === 0) {
    return new Uint8Array(0);
  }

  const exports = getExportsOrThrow();
  const mainPtr = exports.alloc_f64(mainLen);
  const higherClosePtr = higherLen > 0 ? exports.alloc_f64(higherLen) : 0;
  const higherMaskPtr = higherLen > 0 ? exports.alloc_u8(higherLen) : 0;
  const outPtr = exports.alloc_u8(mainLen);

  try {
    new Float64Array(exports.memory.buffer, mainPtr, mainLen).set(mainCloseTimes);
    if (higherLen > 0) {
      new Float64Array(exports.memory.buffer, higherClosePtr, higherLen).set(higherCloseTimes);
      new Uint8Array(exports.memory.buffer, higherMaskPtr, higherLen).set(higherMask);
    }

    exports.align_multi_timeframe_u8_ffi(
      mainPtr,
      mainLen,
      higherClosePtr,
      higherMaskPtr,
      higherLen,
      outPtr,
    );

    return new Uint8Array(exports.memory.buffer, outPtr, mainLen).slice();
  } finally {
    exports.free_f64(mainPtr, mainLen);
    if (higherClosePtr !== 0) {
      exports.free_f64(higherClosePtr, higherLen);
    }
    if (higherMaskPtr !== 0) {
      exports.free_u8(higherMaskPtr, higherLen);
    }
    exports.free_u8(outPtr, mainLen);
  }
}

/**
 * Compute equity curve risk metrics (MDD, MDD duration, Sharpe ratio) in Rust WASM.
 */
export function calculateEquityCurveMetrics(
  equities: Float64Array,
  initialBalance: number,
  annualizationFactor: number,
): { maxDrawdown: number; maxDrawdownDuration: number; sharpeRatio: number } {
  const len = equities.length;
  if (len === 0) {
    return { maxDrawdown: 0, maxDrawdownDuration: 0, sharpeRatio: 0 };
  }

  const exports = getExportsOrThrow();
  const eqPtr = exports.alloc_f64(len);
  const outPtr = exports.alloc_f64(3);

  try {
    new Float64Array(exports.memory.buffer, eqPtr, len).set(equities);
    exports.calculate_equity_metrics_ffi(
      eqPtr,
      len,
      initialBalance,
      annualizationFactor,
      outPtr,
    );
    const out = new Float64Array(exports.memory.buffer, outPtr, 3);
    return {
      maxDrawdown: out[0],
      maxDrawdownDuration: out[1],
      sharpeRatio: out[2],
    };
  } finally {
    exports.free_f64(eqPtr, len);
    exports.free_f64(outPtr, 3);
  }
}
