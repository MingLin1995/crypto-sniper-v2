import { describe, expect, it } from 'bun:test';
import { translations } from './i18n';

describe('Web i18n 多國語系設定', () => {
  it('繁體中文 (zh-TW) 與英文 (en-US) 字典皆應定義齊全', () => {
    expect(translations['zh-TW']).toBeDefined();
    expect(translations['en-US']).toBeDefined();
  });

  it('zh-TW 與 en-US 核心鍵值集合應對齊且不為空', () => {
    const zhKeys = Object.keys(translations['zh-TW']);
    const enKeys = Object.keys(translations['en-US']);

    expect(zhKeys.length).toBeGreaterThan(20);
    expect(enKeys.length).toBeGreaterThan(20);

    // 關鍵登入/註冊/警報鍵值驗證
    const requiredKeys = ['loginTitle', 'registerTitle', 'profileTitle', 'loginBtn', 'registerBtn'];
    for (const key of requiredKeys) {
      expect((translations['zh-TW'] as any)[key]).toBeDefined();
      expect((translations['en-US'] as any)[key]).toBeDefined();
    }
  });
});
