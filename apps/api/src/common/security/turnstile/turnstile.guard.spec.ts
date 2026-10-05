import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { TurnstileGuard } from './turnstile.guard';
import { TurnstileService } from './turnstile.service';

describe('TurnstileGuard', () => {
  let guard: TurnstileGuard;
  let turnstileService: jest.Mocked<TurnstileService>;

  const createMockContext = (req: Partial<any>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnstileGuard,
        {
          provide: TurnstileService,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<TurnstileGuard>(TurnstileGuard);
    turnstileService = module.get(TurnstileService);
  });

  it('當驗證成功時，應允許通過 (回傳 true)', async () => {
    turnstileService.verify.mockResolvedValue({ success: true });

    const context = createMockContext({
      headers: {},
      body: { turnstileToken: 'test-token' },
      ip: '127.0.0.1',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(turnstileService.verify).toHaveBeenCalledWith('test-token', '127.0.0.1');
  });

  it('支援從 x-turnstile-token Header 取得 Token', async () => {
    turnstileService.verify.mockResolvedValue({ success: true });

    const context = createMockContext({
      headers: { 'x-turnstile-token': 'header-token' },
      body: {},
      ip: '127.0.0.1',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(turnstileService.verify).toHaveBeenCalledWith('header-token', '127.0.0.1');
  });

  it('優先解析 cf-connecting-ip 與 x-forwarded-for 作為客戶端 IP', async () => {
    turnstileService.verify.mockResolvedValue({ success: true });

    const context = createMockContext({
      headers: {
        'x-turnstile-token': 'header-token',
        'cf-connecting-ip': '203.0.113.195',
        'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      },
      body: {},
      ip: '127.0.0.1',
    });

    await guard.canActivate(context);
    expect(turnstileService.verify).toHaveBeenCalledWith('header-token', '203.0.113.195');
  });

  it('當驗證失敗時，應拋出 BadRequestException', async () => {
    turnstileService.verify.mockResolvedValue({
      success: false,
      errorCodes: ['invalid-input-response'],
    });

    const context = createMockContext({
      headers: {},
      body: { turnstileToken: 'bad-token' },
      ip: '127.0.0.1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });
});
