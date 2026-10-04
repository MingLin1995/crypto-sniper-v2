export interface OHLCVKline {
  openTime: number; // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}
