import { Test, TestingModule } from '@nestjs/testing';
import { VerificationCodeService } from './verification-code.service';
import { RedisService } from '../common/redis/redis.service';
import { BadRequestException } from '@nestjs/common';

describe('VerificationCodeService (驗證碼服務)', () => {
  let service: VerificationCodeService;

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationCodeService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<VerificationCodeService>(VerificationCodeService);
    jest.clearAllMocks();
  });

  it('應該成功定義 Service', () => {
    expect(service).toBeDefined();
  });

  describe('generateCode (產生驗證碼)', () => {
    it('應該產生 6 位數安全驗證碼並寫入 Redis，同時重設錯誤嘗試次數', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.del.mockResolvedValueOnce(1);

      const code = await service.generateCode('password_reset', 'test@example.com', 600);

      expect(code).toHaveLength(6);
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code, 10)).toBeLessThan(1000000);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'verify_code:password_reset:test@example.com',
        code,
        'EX',
        600,
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'verify_attempts:password_reset:test@example.com',
      );
    });
  });

  describe('verifyCode (校驗驗證碼)', () => {
    const email = 'test@example.com';
    const action = 'password_reset';

    it('驗證成功時，應清除 Redis 中的驗證碼與嘗試次數快取', async () => {
      mockRedisClient.get.mockResolvedValueOnce('123456'); // cached code
      mockRedisClient.get.mockResolvedValueOnce(null); // attempts count (0)
      mockRedisClient.del.mockResolvedValue('OK');

      await expect(service.verifyCode(action, email, '123456')).resolves.toBeUndefined();

      expect(mockRedisClient.del).toHaveBeenCalledWith(`verify_code:${action}:${email}`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`verify_attempts:${action}:${email}`);
    });

    it('如果驗證碼在 Redis 中不存在，應拋出 BadRequestException', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null); // no code cached

      await expect(service.verifyCode(action, email, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('如果錯誤嘗試次數已達到上限，應立即清除驗證碼並拋出失效錯誤', async () => {
      mockRedisClient.get.mockResolvedValueOnce('123456'); // cached code
      mockRedisClient.get.mockResolvedValueOnce('5'); // attempts count (>=5)

      await expect(service.verifyCode(action, email, '123456')).rejects.toThrow(
        /嘗試次數過多，驗證碼已失效/,
      );

      expect(mockRedisClient.del).toHaveBeenCalledWith(`verify_code:${action}:${email}`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`verify_attempts:${action}:${email}`);
    });

    it('如果輸入錯誤驗證碼，且重試次數未達上限，應記錄嘗試次數並拋出錯誤', async () => {
      mockRedisClient.get.mockResolvedValueOnce('123456'); // cached code
      mockRedisClient.get.mockResolvedValueOnce('2'); // attempts count (2)
      mockRedisClient.set.mockResolvedValueOnce('OK');

      await expect(service.verifyCode(action, email, 'wrongcode')).rejects.toThrow(
        /驗證碼錯誤，剩餘嘗試次數：2 次/,
      );

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `verify_attempts:${action}:${email}`,
        '3',
        'EX',
        600,
      );
    });

    it('如果輸入錯誤驗證碼，且此次錯誤達到第 5 次嘗試，應自動將驗證碼作廢', async () => {
      mockRedisClient.get.mockResolvedValueOnce('123456'); // cached code
      mockRedisClient.get.mockResolvedValueOnce('4'); // attempts count (4)
      mockRedisClient.del.mockResolvedValue('OK');

      await expect(service.verifyCode(action, email, 'wrongcode')).rejects.toThrow(
        /驗證碼輸入錯誤次數過多，已自動失效/,
      );

      expect(mockRedisClient.del).toHaveBeenCalledWith(`verify_code:${action}:${email}`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`verify_attempts:${action}:${email}`);
    });
  });
});
