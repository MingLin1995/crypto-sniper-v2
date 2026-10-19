import {
  classifySymbolUniverse,
  DEFAULT_UNIVERSE_CONFIG,
  getUniverseConfigFromEnv,
} from './symbol-universe';

describe('symbol-universe helper', () => {
  const makeSymbolsAndRanking = (count: number, zeroVolumeTail = 0) => {
    const validSymbols = Array.from({ length: count + zeroVolumeTail }, (_, i) => `SYM${i + 1}USDT`);
    const ranking = validSymbols.map((symbol, idx) => ({
      symbol,
      quoteVolume: idx < count ? (count - idx) * 100_000 : 0,
    }));
    return { validSymbols, ranking };
  };

  describe('getUniverseConfigFromEnv', () => {
    it('未設定環境變數時應回傳預設值 (Hot=50, Enter=18%, Exit=25%, Grace=6h)', () => {
      const cfg = getUniverseConfigFromEnv({});
      expect(cfg).toEqual(DEFAULT_UNIVERSE_CONFIG);
    });

    it('應能正確解析自訂環境變數並確保 exitPercent >= enterPercent', () => {
      const cfg = getUniverseConfigFromEnv({
        UNIVERSE_HOT_COUNT: '40',
        UNIVERSE_ENTER_PERCENT: '20',
        UNIVERSE_EXIT_PERCENT: '15', // 小於 enterPercent 時自動對齊為 20
        UNIVERSE_EXIT_GRACE_MS: '3600000',
      });
      expect(cfg).toEqual({
        hotCount: 40,
        enterPercent: 20,
        exitPercent: 20,
        exitGraceMs: 3600000,
      });
    });
  });

  describe('classifySymbolUniverse', () => {
    it('分母應排除 quoteVolume <= 0 的零成交合約，僅取前 18% 進入可交易池 (且保底前 50 為 Hot)', () => {
      // 500 檔有成交量 + 100 檔零成交量，分母 n 應為 500 而非 600
      const { validSymbols, ranking } = makeSymbolsAndRanking(500, 100);
      const now = 1_700_000_000_000;

      const result = classifySymbolUniverse({
        validSymbols,
        ranking,
        now,
      });

      // n = 500 -> Hot = 50, Enter = ceil(500 * 0.18) = 90 -> Warm = 40 (SYM51 ~ SYM90)
      expect(result.totalTradableCandidates).toBe(500);
      expect(result.hot.length).toBe(50);
      expect(result.warm.length).toBe(40);
      expect(result.activeSymbols.length).toBe(90);
      expect(result.excluded.length).toBe(510); // 600 - 90
      expect(result.hot[0]).toBe('SYM1USDT');
      expect(result.warm[0]).toBe('SYM51USDT');
      expect(result.warm[39]).toBe('SYM90USDT');
    });

    it('遲滯緩衝帶 (18% ~ 25%)：原本在池內的標的跌至 19%~25% 應保留並刷新時間戳，新標的在 19%~25% 不進入', () => {
      // n = 500 -> Enter = 90 (18%), Exit = 125 (25%)
      const { validSymbols, ranking } = makeSymbolsAndRanking(500);
      const t0 = 1_700_000_000_000;
      const t1 = t0 + 5 * 60 * 1000;

      // 假設 SYM100USDT (第 100 名，位於 20%) 先前已在池內，而 SYM101USDT 先前不在池內
      const prevMap = {
        SYM100USDT: t0 - 60_000,
      };

      const result = classifySymbolUniverse({
        validSymbols,
        ranking,
        previousActiveMap: prevMap,
        now: t1,
      });

      expect(result.warm).toContain('SYM100USDT');
      expect(result.warm).not.toContain('SYM101USDT');
      // 因為仍在 25% 退出線內，時間戳應刷新為 t1
      expect(result.activeTimestampMap['SYM100USDT']).toBe(t1);
    });

    it('6 小時退出寬限期：跌出前 25% 未滿 6 小時應繼續保留，滿 6 小時後應移出並列入 dropped', () => {
      // n = 500 -> Exit = 125 (25%)
      const { validSymbols, ranking } = makeSymbolsAndRanking(500);
      const t0 = 1_700_000_000_000;
      const graceMs = DEFAULT_UNIVERSE_CONFIG.exitGraceMs; // 6h

      // SYM200USDT 在第 200 名 (40% > 25%)
      const prevMap = {
        SYM200USDT: t0,
      };

      // 1. 經過 3 小時 (未滿 6 小時)：仍在寬限期內
      const withinGrace = classifySymbolUniverse({
        validSymbols,
        ranking,
        previousActiveMap: prevMap,
        now: t0 + graceMs - 1000,
      });
      expect(withinGrace.warm).toContain('SYM200USDT');
      expect(withinGrace.dropped).not.toContain('SYM200USDT');
      // 時間戳維持原本的 t0，不刷新
      expect(withinGrace.activeTimestampMap['SYM200USDT']).toBe(t0);

      // 2. 經過 6 小時：寬限期屆滿，正式退池並進入 dropped 清單
      const afterGrace = classifySymbolUniverse({
        validSymbols,
        ranking,
        previousActiveMap: withinGrace.activeTimestampMap,
        now: t0 + graceMs,
      });
      expect(afterGrace.warm).not.toContain('SYM200USDT');
      expect(afterGrace.activeSymbols).not.toContain('SYM200USDT');
      expect(afterGrace.dropped).toContain('SYM200USDT');
    });

    it('Pinned 白名單：使用者的自選清單標的即使排名在 25% 之外，仍應強制納入 pinned 與 activeSymbols', () => {
      const { validSymbols, ranking } = makeSymbolsAndRanking(500);

      const result = classifySymbolUniverse({
        validSymbols,
        ranking,
        pinnedSymbols: ['sym450usdt', 'SYM1USDT', 'INVALID_SYMBOL'],
      });

      // SYM1USDT 已在 hot，不重複放入 pinned；SYM450USDT 放入 pinned；INVALID_SYMBOL 不在 validSymbols 被過濾
      expect(result.pinned).toEqual(['SYM450USDT']);
      expect(result.activeSymbols).toContain('SYM450USDT');
      expect(result.excluded).not.toContain('SYM450USDT');
    });

    it('市場極冷或標的數少於 50 檔時，應保底取前 50 (或全部有效標的)', () => {
      const { validSymbols, ranking } = makeSymbolsAndRanking(30);
      const result = classifySymbolUniverse({
        validSymbols,
        ranking,
      });

      expect(result.hot.length).toBe(30);
      expect(result.warm.length).toBe(0);
      expect(result.activeSymbols.length).toBe(30);
    });

    it('排行快取缺失降級 (ranking 為空) 時，應強制將五大主流幣錨點置頂納入 hot，防止字首迷因幣佔滿前 18%', () => {
      const memeSymbols = Array.from({ length: 300 }, (_, i) => `1000MEME${i + 1}USDT`);
      const validSymbols = [...memeSymbols, 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

      const result = classifySymbolUniverse({
        validSymbols,
        ranking: [],
      });

      expect(result.hot.slice(0, 3)).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
      expect(result.activeSymbols).toContain('BTCUSDT');
      expect(result.activeSymbols).toContain('ETHUSDT');
      expect(result.activeSymbols).toContain('SOLUSDT');
    });
  });
});
