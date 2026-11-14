use std::slice;

/// Allocate a contiguous buffer of `len` f64 elements in linear memory.
/// Returns a null pointer if `len == 0`.
#[no_mangle]
pub extern "C" fn alloc_f64(len: usize) -> *mut f64 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    let mut buf = vec![0.0_f64; len];
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

/// Free a previously allocated `f64` buffer of length `len`.
#[no_mangle]
pub extern "C" fn free_f64(ptr: *mut f64, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    unsafe {
        let _ = Vec::from_raw_parts(ptr, len, len);
    }
}

/// Allocate a contiguous buffer of `len` u8 elements in linear memory.
/// Returns a null pointer if `len == 0`.
#[no_mangle]
pub extern "C" fn alloc_u8(len: usize) -> *mut u8 {
    if len == 0 {
        return std::ptr::null_mut();
    }
    let mut buf = vec![0_u8; len];
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

/// Free a previously allocated `u8` buffer of length `len`.
#[no_mangle]
pub extern "C" fn free_u8(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    unsafe {
        let _ = Vec::from_raw_parts(ptr, len, len);
    }
}

/// Compute Simple Moving Average (SMA) into `out`.
/// Uses `f64::NAN` to represent `null` values before warm-up completes.
pub fn calculate_sma_slice(prices: &[f64], period: usize, out: &mut [f64]) {
    let len = prices.len().min(out.len());
    out[..len].fill(f64::NAN);

    if period == 0 || len < period {
        return;
    }

    let mut sum = 0.0_f64;
    let period_f = period as f64;

    for i in 0..len {
        sum += prices[i];
        if i >= period {
            sum -= prices[i - period];
        }
        if i >= period - 1 {
            out[i] = sum / period_f;
        }
    }
}

/// Compute Exponential Moving Average (EMA) into `out`.
/// The first EMA value at `period - 1` is seeded with the SMA of the first `period` prices.
pub fn calculate_ema_slice(prices: &[f64], period: usize, out: &mut [f64]) {
    let len = prices.len().min(out.len());
    out[..len].fill(f64::NAN);

    if period == 0 || len < period {
        return;
    }

    let mut sum = 0.0_f64;
    for i in 0..period {
        sum += prices[i];
    }
    let seed_sma = sum / (period as f64);
    out[period - 1] = seed_sma;

    let k = 2.0_f64 / ((period + 1) as f64);
    let one_minus_k = 1.0_f64 - k;
    for i in period..len {
        out[i] = prices[i] * k + out[i - 1] * one_minus_k;
    }
}

/// Compute Relative Strength Index (RSI) using Wilder's smoothing into `out`.
pub fn calculate_rsi_slice(prices: &[f64], period: usize, out: &mut [f64]) {
    let len = prices.len().min(out.len());
    out[..len].fill(f64::NAN);

    if period == 0 || len <= period {
        return;
    }

    let mut avg_gain = 0.0_f64;
    let mut avg_loss = 0.0_f64;
    let period_f = period as f64;
    let period_minus_one = (period - 1) as f64;

    for i in 1..=period {
        let change = prices[i] - prices[i - 1];
        if change > 0.0 {
            avg_gain += change;
        } else {
            avg_loss += -change;
        }
    }

    avg_gain /= period_f;
    avg_loss /= period_f;

    if avg_gain + avg_loss == 0.0 {
        out[period] = 50.0;
    } else if avg_loss == 0.0 {
        out[period] = 100.0;
    } else {
        out[period] = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss);
    }

    for i in (period + 1)..len {
        let change = prices[i] - prices[i - 1];
        let gain = if change > 0.0 { change } else { 0.0 };
        let loss = if change < 0.0 { -change } else { 0.0 };

        avg_gain = (avg_gain * period_minus_one + gain) / period_f;
        avg_loss = (avg_loss * period_minus_one + loss) / period_f;

        if avg_gain + avg_loss == 0.0 {
            out[i] = 50.0;
        } else if avg_loss == 0.0 {
            out[i] = 100.0;
        } else {
            out[i] = 100.0 - 100.0 / (1.0 + avg_gain / avg_loss);
        }
    }
}

/// Compute MACD, Signal, and Histogram series into `macd_out`, `signal_out`, and `hist_out`.
pub fn calculate_macd_slice(
    prices: &[f64],
    fast_period: usize,
    slow_period: usize,
    signal_period: usize,
    macd_out: &mut [f64],
    signal_out: &mut [f64],
    hist_out: &mut [f64],
) {
    let len = prices
        .len()
        .min(macd_out.len())
        .min(signal_out.len())
        .min(hist_out.len());

    macd_out[..len].fill(f64::NAN);
    signal_out[..len].fill(f64::NAN);
    hist_out[..len].fill(f64::NAN);

    if len < slow_period || fast_period == 0 || slow_period == 0 {
        return;
    }

    let mut ema_fast = vec![f64::NAN; len];
    let mut ema_slow = vec![f64::NAN; len];

    calculate_ema_slice(&prices[..len], fast_period, &mut ema_fast);
    calculate_ema_slice(&prices[..len], slow_period, &mut ema_slow);

    let mut first_valid_macd_idx: Option<usize> = None;
    for i in 0..len {
        let f = ema_fast[i];
        let s = ema_slow[i];
        if !f.is_nan() && !s.is_nan() {
            macd_out[i] = f - s;
            if first_valid_macd_idx.is_none() {
                first_valid_macd_idx = Some(i);
            }
        }
    }

    let first_idx = match first_valid_macd_idx {
        Some(idx) if signal_period > 0 && len - idx >= signal_period => idx,
        _ => return,
    };

    let mut sum = 0.0_f64;
    for i in first_idx..(first_idx + signal_period) {
        sum += macd_out[i];
    }
    let seed_sma = sum / (signal_period as f64);
    let signal_start_idx = first_idx + signal_period - 1;
    signal_out[signal_start_idx] = seed_sma;

    let k = 2.0_f64 / ((signal_period + 1) as f64);
    let one_minus_k = 1.0_f64 - k;

    for i in (signal_start_idx + 1)..len {
        let m = macd_out[i];
        let prev_sig = signal_out[i - 1];
        if !m.is_nan() && !prev_sig.is_nan() {
            signal_out[i] = m * k + prev_sig * one_minus_k;
        }
    }

    for i in 0..len {
        let m = macd_out[i];
        let sig = signal_out[i];
        if !m.is_nan() && !sig.is_nan() {
            hist_out[i] = m - sig;
        }
    }
}

/// FFI entry point for SMA calculation.
#[no_mangle]
pub extern "C" fn calculate_sma_ffi(
    prices_ptr: *const f64,
    len: usize,
    period: usize,
    out_ptr: *mut f64,
) {
    if len == 0 || prices_ptr.is_null() || out_ptr.is_null() {
        return;
    }
    let prices = unsafe { slice::from_raw_parts(prices_ptr, len) };
    let out = unsafe { slice::from_raw_parts_mut(out_ptr, len) };
    calculate_sma_slice(prices, period, out);
}

/// FFI entry point for EMA calculation.
#[no_mangle]
pub extern "C" fn calculate_ema_ffi(
    prices_ptr: *const f64,
    len: usize,
    period: usize,
    out_ptr: *mut f64,
) {
    if len == 0 || prices_ptr.is_null() || out_ptr.is_null() {
        return;
    }
    let prices = unsafe { slice::from_raw_parts(prices_ptr, len) };
    let out = unsafe { slice::from_raw_parts_mut(out_ptr, len) };
    calculate_ema_slice(prices, period, out);
}

/// FFI entry point for RSI calculation.
#[no_mangle]
pub extern "C" fn calculate_rsi_ffi(
    prices_ptr: *const f64,
    len: usize,
    period: usize,
    out_ptr: *mut f64,
) {
    if len == 0 || prices_ptr.is_null() || out_ptr.is_null() {
        return;
    }
    let prices = unsafe { slice::from_raw_parts(prices_ptr, len) };
    let out = unsafe { slice::from_raw_parts_mut(out_ptr, len) };
    calculate_rsi_slice(prices, period, out);
}

/// FFI entry point for MACD calculation.
#[no_mangle]
pub extern "C" fn calculate_macd_ffi(
    prices_ptr: *const f64,
    len: usize,
    fast_period: usize,
    slow_period: usize,
    signal_period: usize,
    macd_out_ptr: *mut f64,
    signal_out_ptr: *mut f64,
    hist_out_ptr: *mut f64,
) {
    if len == 0
        || prices_ptr.is_null()
        || macd_out_ptr.is_null()
        || signal_out_ptr.is_null()
        || hist_out_ptr.is_null()
    {
        return;
    }
    let prices = unsafe { slice::from_raw_parts(prices_ptr, len) };
    let macd_out = unsafe { slice::from_raw_parts_mut(macd_out_ptr, len) };
    let signal_out = unsafe { slice::from_raw_parts_mut(signal_out_ptr, len) };
    let hist_out = unsafe { slice::from_raw_parts_mut(hist_out_ptr, len) };
    calculate_macd_slice(
        prices,
        fast_period,
        slow_period,
        signal_period,
        macd_out,
        signal_out,
        hist_out,
    );
}

/// Vectorized condition evaluation across a full series.
/// `compare_mode`: `0` = compare against `series2_ptr`, `1` = compare against scalar `compare_value`.
/// `operator`: `0` = `gt` (`>`), `1` = `lt` (`<`).
/// Writes `1` or `0` into `out_mask_ptr` and returns the total matched count.
#[no_mangle]
pub extern "C" fn scan_signals_ffi(
    series1_ptr: *const f64,
    series2_ptr: *const f64,
    len: usize,
    compare_mode: u32,
    compare_value: f64,
    operator: u32,
    out_mask_ptr: *mut u8,
) -> usize {
    if len == 0 || series1_ptr.is_null() || out_mask_ptr.is_null() {
        return 0;
    }

    let series1 = unsafe { slice::from_raw_parts(series1_ptr, len) };
    let out_mask = unsafe { slice::from_raw_parts_mut(out_mask_ptr, len) };

    if compare_mode == 1 {
        if compare_value.is_nan() {
            out_mask.fill(0);
            return 0;
        }
        let mut count = 0_usize;
        for i in 0..len {
            let v1 = series1[i];
            if v1.is_nan() {
                out_mask[i] = 0;
                continue;
            }
            let matched = match operator {
                0 => v1 > compare_value,
                1 => v1 < compare_value,
                _ => false,
            };
            if matched {
                out_mask[i] = 1;
                count += 1;
            } else {
                out_mask[i] = 0;
            }
        }
        return count;
    }

    if series2_ptr.is_null() {
        out_mask.fill(0);
        return 0;
    }

    let series2 = unsafe { slice::from_raw_parts(series2_ptr, len) };
    let mut count = 0_usize;

    for i in 0..len {
        let v1 = series1[i];
        let v2 = series2[i];
        if v1.is_nan() || v2.is_nan() {
            out_mask[i] = 0;
            continue;
        }
        let matched = match operator {
            0 => v1 > v2,
            1 => v1 < v2,
            _ => false,
        };
        if matched {
            out_mask[i] = 1;
            count += 1;
        } else {
            out_mask[i] = 0;
        }
    }

    count
}

/// Align higher-timeframe signal mask onto main-timeframe bars without look-ahead bias.
/// Only uses a higher-timeframe bar when `higher_close_times[idx] <= main_close_times[i]`.
/// Writes `255` (`u8::MAX`) when no higher-timeframe bar has closed yet.
#[no_mangle]
pub extern "C" fn align_multi_timeframe_u8_ffi(
    main_close_ptr: *const f64,
    main_len: usize,
    higher_close_ptr: *const f64,
    higher_vals_ptr: *const u8,
    higher_len: usize,
    out_aligned_ptr: *mut u8,
) {
    if main_len == 0 || main_close_ptr.is_null() || out_aligned_ptr.is_null() {
        return;
    }

    let main_closes = unsafe { slice::from_raw_parts(main_close_ptr, main_len) };
    let out_aligned = unsafe { slice::from_raw_parts_mut(out_aligned_ptr, main_len) };

    if higher_len == 0 || higher_close_ptr.is_null() || higher_vals_ptr.is_null() {
        out_aligned.fill(u8::MAX);
        return;
    }

    let higher_closes = unsafe { slice::from_raw_parts(higher_close_ptr, higher_len) };
    let higher_vals = unsafe { slice::from_raw_parts(higher_vals_ptr, higher_len) };

    let mut higher_idx = 0_usize;
    for i in 0..main_len {
        let main_close = main_closes[i];
        while higher_idx + 1 < higher_len && higher_closes[higher_idx + 1] <= main_close {
            higher_idx += 1;
        }

        if higher_idx < higher_len && higher_closes[higher_idx] <= main_close {
            out_aligned[i] = higher_vals[higher_idx];
        } else {
            out_aligned[i] = u8::MAX;
        }
    }
}

/// Compute equity curve risk metrics in two zero-allocation passes:
/// `out_metrics[0] = max_drawdown`
/// `out_metrics[1] = max_drawdown_duration`
/// `out_metrics[2] = sharpe_ratio`
#[no_mangle]
pub extern "C" fn calculate_equity_metrics_ffi(
    equities_ptr: *const f64,
    len: usize,
    initial_balance: f64,
    annualization_factor: f64,
    out_metrics_ptr: *mut f64,
) {
    if out_metrics_ptr.is_null() {
        return;
    }
    let out_metrics = unsafe { slice::from_raw_parts_mut(out_metrics_ptr, 3) };
    out_metrics.fill(0.0);

    if len == 0 || equities_ptr.is_null() {
        return;
    }

    let equities = unsafe { slice::from_raw_parts(equities_ptr, len) };

    let mut peak = initial_balance;
    let mut max_drawdown = 0.0_f64;
    let mut current_peak_idx = 0_usize;
    let mut max_drawdown_duration = 0_usize;

    for (i, &eq) in equities.iter().enumerate() {
        if eq > peak {
            peak = eq;
            current_peak_idx = i;
        } else {
            let dd = if peak != 0.0 { (peak - eq) / peak } else { 0.0 };
            if dd > max_drawdown {
                max_drawdown = dd;
            }
            let dd_duration = i - current_peak_idx;
            if dd_duration > max_drawdown_duration {
                max_drawdown_duration = dd_duration;
            }
        }
    }

    let mut sharpe_ratio = 0.0_f64;
    if len > 1 {
        let ret_count = (len - 1) as f64;
        let mut sum_returns = 0.0_f64;
        for i in 1..len {
            let prev = equities[i - 1];
            let curr = equities[i];
            let ret = if prev == 0.0 { 0.0 } else { (curr - prev) / prev };
            sum_returns += ret;
        }
        let avg_return = sum_returns / ret_count;

        let mut sum_sq_diff = 0.0_f64;
        for i in 1..len {
            let prev = equities[i - 1];
            let curr = equities[i];
            let ret = if prev == 0.0 { 0.0 } else { (curr - prev) / prev };
            let diff = ret - avg_return;
            sum_sq_diff += diff * diff;
        }
        let variance = sum_sq_diff / ret_count;
        let std_dev = variance.sqrt();

        if std_dev > 0.0 {
            sharpe_ratio = (avg_return / std_dev) * annualization_factor.sqrt();
        }
    }

    out_metrics[0] = max_drawdown;
    out_metrics[1] = max_drawdown_duration as f64;
    out_metrics[2] = sharpe_ratio;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_close(a: f64, b: f64, eps: f64) {
        assert!((a - b).abs() <= eps, "expected {a} to be within {eps} of {b}");
    }

    #[test]
    fn test_sma() {
        let prices = [10.0, 20.0, 30.0, 40.0, 50.0];
        let mut out = vec![0.0; prices.len()];
        calculate_sma_slice(&prices, 3, &mut out);
        assert!(out[0].is_nan());
        assert!(out[1].is_nan());
        assert_close(out[2], 20.0, 1e-12);
        assert_close(out[3], 30.0, 1e-12);
        assert_close(out[4], 40.0, 1e-12);
    }

    #[test]
    fn test_ema() {
        let prices = [10.0, 20.0, 30.0, 40.0];
        let mut out = vec![0.0; prices.len()];
        calculate_ema_slice(&prices, 3, &mut out);
        assert!(out[0].is_nan());
        assert!(out[1].is_nan());
        assert_close(out[2], 20.0, 1e-12);
        assert_close(out[3], 30.0, 1e-12);
    }

    #[test]
    fn test_rsi() {
        let prices = [
            10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0, 24.0, 26.0, 28.0, 30.0, 32.0, 34.0, 36.0,
            38.0,
        ];
        let mut out = vec![0.0; prices.len()];
        calculate_rsi_slice(&prices, 14, &mut out);
        assert!(out[0].is_nan());
        assert!(out[13].is_nan());
        assert_close(out[14], 100.0, 1e-12);
    }

    #[test]
    fn test_macd() {
        let prices: Vec<f64> = (0..35).map(|i| 100.0 + i as f64).collect();
        let mut macd = vec![0.0; prices.len()];
        let mut signal = vec![0.0; prices.len()];
        let mut hist = vec![0.0; prices.len()];
        calculate_macd_slice(&prices, 12, 26, 9, &mut macd, &mut signal, &mut hist);
        assert!(macd[24].is_nan());
        assert!(!macd[25].is_nan());
        assert!(signal[32].is_nan());
        assert!(!signal[33].is_nan());
        assert_close(hist[33], macd[33] - signal[33], 1e-12);
    }

    #[test]
    fn test_scan_signals_and_align() {
        let s1 = [f64::NAN, 10.0, 20.0, 15.0];
        let s2 = [5.0, 12.0, 15.0, 20.0];
        let mut mask = [0_u8; 4];
        let hits = scan_signals_ffi(
            s1.as_ptr(),
            s2.as_ptr(),
            4,
            0,
            0.0,
            0,
            mask.as_mut_ptr(),
        );
        assert_eq!(hits, 1);
        assert_eq!(mask, [0, 0, 1, 0]);

        let main_closes = [100.0, 200.0, 300.0, 400.0];
        let higher_closes = [250.0, 450.0];
        let higher_vals = [1_u8, 0_u8];
        let mut aligned = [0_u8; 4];
        align_multi_timeframe_u8_ffi(
            main_closes.as_ptr(),
            4,
            higher_closes.as_ptr(),
            higher_vals.as_ptr(),
            2,
            aligned.as_mut_ptr(),
        );
        assert_eq!(aligned, [255, 255, 1, 1]);
    }

    #[test]
    fn test_equity_metrics() {
        let equities = [10000.0, 10500.0, 9500.0, 11000.0, 12000.0];
        let mut out = [0.0; 3];
        calculate_equity_metrics_ffi(equities.as_ptr(), equities.len(), 10000.0, 365.0, out.as_mut_ptr());
        assert_close(out[0], 1000.0 / 10500.0, 1e-12);
        assert_close(out[1], 1.0, 1e-12);
        assert!(out[2] > 0.0);
    }
}
