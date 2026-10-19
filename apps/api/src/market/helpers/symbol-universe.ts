import { VolumeRanking } from '../binance.service';

export interface SymbolUniverseConfig {
  hotCount: number;
  enterPercent: number;
  exitPercent: number;
  exitGraceMs: number;
}

export const DEFAULT_UNIVERSE_CONFIG: SymbolUniverseConfig = {
  hotCount: 50,
  enterPercent: 18,
  exitPercent: 25,
  exitGraceMs: 6 * 60 * 60 * 1000, // 6 小時 (21,600,000 ms)
};

export function getUniverseConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): SymbolUniverseConfig {
  const parsePositiveNumber = (val: string | undefined, fallback: number): number => {
    if (val === undefined || val.trim() === '') return fallback;
    const parsed = Number(val);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };

  const hotCount = Math.floor(
    parsePositiveNumber(env.UNIVERSE_HOT_COUNT, DEFAULT_UNIVERSE_CONFIG.hotCount),
  );
  const enterPercent = parsePositiveNumber(
    env.UNIVERSE_ENTER_PERCENT,
    DEFAULT_UNIVERSE_CONFIG.enterPercent,
  );
  const exitPercent = Math.max(
    enterPercent,
    parsePositiveNumber(env.UNIVERSE_EXIT_PERCENT, DEFAULT_UNIVERSE_CONFIG.exitPercent),
  );
  const exitGraceMs = Math.floor(
    parsePositiveNumber(env.UNIVERSE_EXIT_GRACE_MS, DEFAULT_UNIVERSE_CONFIG.exitGraceMs),
  );

  return {
    hotCount,
    enterPercent,
    exitPercent,
    exitGraceMs,
  };
}

export interface ClassifySymbolUniverseInput {
  validSymbols: string[];
  ranking: VolumeRanking[];
  pinnedSymbols?: string[];
  previousActiveMap?: Record<string, number> | null;
  now?: number;
  config?: Partial<SymbolUniverseConfig>;
}

export interface SymbolUniverseResult {
  hot: string[];
  warm: string[];
  pinned: string[];
  activeSymbols: string[];
  excluded: string[];
  dropped: string[];
  activeTimestampMap: Record<string, number>;
  totalTradableCandidates: number;
}

/**
 * 依據 24h 成交額排名百分比、遲滯退出寬限期與自選清單白名單，計算當前活躍標的池 (Active Universe)
 * - 分母 n：僅計算 TRADING 狀態之 USDT 永續合約且 quoteVolume > 0 的有效標的
 * - Hot：排名前 hotCount (預設 50)
 * - 進入條件 (Enter)：排名 <= ceil(n * enterPercent%) 或位於前 hotCount
 * - 離開條件 (Exit)：排名 > ceil(n * exitPercent%) 且連續超過 exitGraceMs (預設 6 小時)
 * - Pinned：使用者 Watchlist 自選標的強制保留於池內
 */
export function classifySymbolUniverse(
  input: ClassifySymbolUniverseInput,
): SymbolUniverseResult {
  const cfg: SymbolUniverseConfig = {
    ...DEFAULT_UNIVERSE_CONFIG,
    ...input.config,
  };
  if (cfg.exitPercent < cfg.enterPercent) {
    cfg.exitPercent = cfg.enterPercent;
  }

  const now = input.now ?? Date.now();
  const prevMap: Record<string, number> = input.previousActiveMap ?? {};

  // 去重並維持有效合約清單
  const uniqueValidSymbols = Array.from(new Set(input.validSymbols));
  const validSet = new Set(uniqueValidSymbols);

  // 建立 24h 成交額查表
  const volumeMap = new Map<string, number>();
  for (const item of input.ranking || []) {
    if (
      item &&
      typeof item.symbol === 'string' &&
      typeof item.quoteVolume === 'number' &&
      !Number.isNaN(item.quoteVolume)
    ) {
      volumeMap.set(item.symbol, item.quoteVolume);
    }
  }

  // 分母只取 TRADING、USDT 永續且 quoteVolume > 0 的標的
  // 若排行快取暫時為空或未提供 (ranking 為空)，則降級以 uniqueValidSymbols 作為候選池，
  // 並強制將五大主流幣錨點置頂，避免依字母/exchangeInfo 順序切前 18% 時遺漏主流幣 (案例 25 防禦)
  const fallbackAnchors = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
  const positiveVolumeSymbols = uniqueValidSymbols.filter(
    (s) => (volumeMap.get(s) ?? 0) > 0,
  );
  const candidates =
    positiveVolumeSymbols.length > 0
      ? [...positiveVolumeSymbols]
      : [
          ...fallbackAnchors.filter((s) => validSet.has(s)),
          ...uniqueValidSymbols.filter((s) => !fallbackAnchors.includes(s)),
        ];

  // 依 24h quoteVolume 降冪排序
  if (positiveVolumeSymbols.length > 0) {
    candidates.sort((a, b) => {
      const volA = volumeMap.get(a) ?? 0;
      const volB = volumeMap.get(b) ?? 0;
      return volB - volA;
    });
  }

  const n = candidates.length;
  const hotCutoff = Math.min(n, Math.max(0, cfg.hotCount));
  const enterCutoff = Math.min(
    n,
    Math.max(hotCutoff, Math.ceil((n * cfg.enterPercent) / 100)),
  );
  const exitCutoff = Math.min(
    n,
    Math.max(enterCutoff, Math.ceil((n * cfg.exitPercent) / 100)),
  );

  const hot: string[] = [];
  const warm: string[] = [];
  const activeTimestampMap: Record<string, number> = {};

  for (let idx = 0; idx < n; idx++) {
    const symbol = candidates[idx];

    if (idx < hotCutoff) {
      hot.push(symbol);
      activeTimestampMap[symbol] = now;
    } else if (idx < enterCutoff) {
      // 排名在進入線內 (例如 <= ceil(n * 0.18))
      warm.push(symbol);
      activeTimestampMap[symbol] = now;
    } else if (idx < exitCutoff) {
      // 位於遲滯緩衝帶 (enterCutoff < rank <= exitCutoff)：若原本已在池內則保留並刷新時間戳
      if (prevMap[symbol] !== undefined) {
        warm.push(symbol);
        activeTimestampMap[symbol] = now;
      }
    } else {
      // 跌出退出線 (rank > exitCutoff)：檢查是否在 6 小時寬限期內
      const lastInPoolAt = prevMap[symbol];
      if (lastInPoolAt !== undefined && now - lastInPoolAt < cfg.exitGraceMs) {
        warm.push(symbol);
        activeTimestampMap[symbol] = lastInPoolAt;
      }
    }
  }

  // 若先前在池內的標的不在本次 candidates (例如當下 quoteVolume 變為 0 但仍在 validSet)，同樣檢查寬限期
  const candidateSet = new Set(candidates);
  for (const [symbol, lastInPoolAt] of Object.entries(prevMap)) {
    if (!candidateSet.has(symbol) && validSet.has(symbol)) {
      if (now - lastInPoolAt < cfg.exitGraceMs) {
        warm.push(symbol);
        activeTimestampMap[symbol] = lastInPoolAt;
      }
    }
  }

  const hotAndWarmSet = new Set([...hot, ...warm]);
  const pinned: string[] = [];
  const pinnedSeen = new Set<string>();

  for (const rawSym of input.pinnedSymbols || []) {
    if (!rawSym || typeof rawSym !== 'string') continue;
    const sym = rawSym.trim().toUpperCase();
    if (!sym || pinnedSeen.has(sym)) continue;
    pinnedSeen.add(sym);

    if (validSet.size > 0 && !validSet.has(sym)) {
      continue;
    }
    if (!hotAndWarmSet.has(sym)) {
      pinned.push(sym);
    }
  }

  const activeSymbols = [...hot, ...warm, ...pinned];
  const activeSet = new Set(activeSymbols);

  const excluded = uniqueValidSymbols.filter((s) => !activeSet.has(s));
  const dropped = Object.keys(prevMap).filter((s) => !activeSet.has(s));

  return {
    hot,
    warm,
    pinned,
    activeSymbols,
    excluded,
    dropped,
    activeTimestampMap,
    totalTradableCandidates: n,
  };
}
