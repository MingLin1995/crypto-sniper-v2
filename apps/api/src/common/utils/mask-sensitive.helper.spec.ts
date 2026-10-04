import { maskSensitiveData, safeStringify } from './mask-sensitive.helper';

describe('maskSensitiveData (敏感資料遮罩工具)', () => {
  it('憑證與密碼欄位應被完全遮蔽 (full mask)', () => {
    const data = {
      password: 'SuperSecretPassword123!',
      token: 'jwt.token.here',
      secret: 'my-api-secret',
      email: 'user@example.com',
    };

    const masked = maskSensitiveData(data);

    expect(masked.password).toBe('*****');
    expect(masked.token).toBe('*****');
    expect(masked.secret).toBe('*****');
    expect(masked.email).toBe('user@example.com');
  });

  it('應能遞迴遮罩嵌套物件與陣列中的敏感資料', () => {
    const nestedData = {
      user: {
        id: '123',
        newPassword: 'MyNewPassword',
        cards: [
          { cardNumber: '1234567890123456', cvv: '123' },
        ],
      },
    };

    const masked = maskSensitiveData(nestedData);

    expect(masked.user.newPassword).toBe('*****');
    expect(masked.user.cards[0].cvv).toBe('*****');
    // cardNumber 不是 full mask，長度大於 4，應保留前後各 2 個字元
    expect(masked.user.cards[0].cardNumber).toContain('12');
    expect(masked.user.cards[0].cardNumber).toContain('56');
    expect(masked.user.cards[0].cardNumber).toContain('*');
  });

  it('safeStringify 應能安全序列化並回傳 JSON 字串', () => {
    const data = { apiKey: 'secret-key-123', username: 'trader1' };
    const str = safeStringify(data);

    expect(str).toBeDefined();
    expect(str).toContain('"apiKey":"*****"');
    expect(str).toContain('"username":"trader1"');
  });

  it('處理 null 與 undefined 時應正常回傳', () => {
    expect(maskSensitiveData(null)).toBeNull();
    expect(maskSensitiveData(undefined)).toBeUndefined();
    expect(safeStringify(null)).toBeNull();
  });
});
