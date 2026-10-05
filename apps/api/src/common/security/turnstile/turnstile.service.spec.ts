import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let service: TurnstileService;
  let configService: jest.Mocked<ConfigService>;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnstileService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TurnstileService>(TurnstileService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('verify', () => {
    it('若 TURNSTILE_ENABLED=false，應直接放行', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TURNSTILE_ENABLED') return 'false';
        return undefined;
      });

      const result = await service.verify('any-token');
      expect(result.success).toBe(true);
    });

    it('未設置 Secret Key 時，應自動優雅旁路放行以避免系統鎖死', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TURNSTILE_ENABLED') return 'true';
        if (key === 'TURNSTILE_SECRET_KEY') return undefined;
        return undefined;
      });

      const result = await service.verify('any-token');
      expect(result.success).toBe(true);
      expect(service.isConfigured()).toBe(false);
    });

    it('已啟用但未提供 Token 時，應回傳 missing-input-response', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TURNSTILE_ENABLED') return 'true';
        if (key === 'TURNSTILE_SECRET_KEY') return 'secret-123';
        return undefined;
      });

      const result = await service.verify('');
      expect(result.success).toBe(false);
      expect(result.errorCodes).toContain('missing-input-response');
    });

    it('Cloudflare 驗證成功時，應回傳 success: true 與詳細資訊', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TURNSTILE_ENABLED') return 'true';
        if (key === 'TURNSTILE_SECRET_KEY') return 'secret-123';
        return undefined;
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          challenge_ts: '2026-10-05T00:00:00Z',
          hostname: 'example.com',
        }),
      } as any);

      const result = await service.verify('valid-token', '1.2.3.4');
      expect(result.success).toBe(true);
      expect(result.hostname).toBe('example.com');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('Cloudflare 驗證失敗時，應回傳 success: false 與 error codes', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TURNSTILE_ENABLED') return 'true';
        if (key === 'TURNSTILE_SECRET_KEY') return 'secret-123';
        return undefined;
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          'error-codes': ['invalid-input-response'],
        }),
      } as any);

      const result = await service.verify('invalid-token');
      expect(result.success).toBe(false);
      expect(result.errorCodes).toContain('invalid-input-response');
    });

    it('當連線至 Cloudflare 發生網路錯誤時，應優雅攔截並回傳 network-error', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TURNSTILE_ENABLED') return 'true';
        if (key === 'TURNSTILE_SECRET_KEY') return 'secret-123';
        return undefined;
      });

      global.fetch = jest.fn().mockRejectedValue(new Error('Connection timed out'));

      const result = await service.verify('any-token');
      expect(result.success).toBe(false);
      expect(result.errorCodes).toContain('network-error');
    });

    it('當 Cloudflare 回應 HTTP 異常狀態碼時，應回傳對應錯誤代碼', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TURNSTILE_ENABLED') return 'true';
        if (key === 'TURNSTILE_SECRET_KEY') return 'secret-123';
        return undefined;
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
      } as any);

      const result = await service.verify('any-token');
      expect(result.success).toBe(false);
      expect(result.errorCodes).toContain('http-502');
    });
  });
});
