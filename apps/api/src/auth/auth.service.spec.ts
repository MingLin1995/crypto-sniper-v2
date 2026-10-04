import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../common/email/email.service';
import { VerificationCodeService } from './verification-code.service';

describe('AuthService (認證服務)', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshTokenById: jest.fn(),
    deleteRefreshToken: jest.fn(),
    deleteUserRefreshTokens: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'JWT_SECRET') return 'test-jwt-secret';
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
      if (key === 'JWT_EXPIRES_IN') return '30m';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return null;
    }),
  };

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  const mockEmailService = {
    send: jest.fn(),
  };

  const mockVerificationCodeService = {
    generateCode: jest.fn(),
    verifyCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: VerificationCodeService, useValue: mockVerificationCodeService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('服務應該要被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser (驗證使用者密碼)', () => {
    const loginDto = { email: 'test@example.com', password: 'Password123' };

    it('密碼正確時應回傳使用者資料', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: hashedPassword,
      });
      mockUsersService.findOne.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        nickname: '小明',
        role: 'USER',
      });

      const result = await service.validateUser(loginDto);
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
    });

    it('密碼錯誤時應拋出 UnauthorizedException', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'wrong-hashed-password',
      });

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('找不到使用者時應拋出 UnauthorizedException', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('若使用者為第三方登入者（無密碼）應拋出 UnauthorizedException 拒絕帳密登入', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: null,
      });

      await expect(service.validateUser(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login (使用者登入簽發 Token)', () => {
    it('應能成功簽發 Access Token 與 Refresh Token 並寫入資料庫', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        nickname: '小明',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token-123')
        .mockResolvedValueOnce('refresh-token-123');

      const result = await service.login(user);

      expect(result).toHaveProperty('accessToken', 'access-token-123');
      expect(result).toHaveProperty('refreshToken', 'refresh-token-123');
      expect(mockUsersService.createRefreshToken).toHaveBeenCalled();
    });
  });

  describe('logout (使用者登出)', () => {
    it('登出時應刪除對應的 Refresh Token 紀錄', async () => {
      const requestUser = { sub: '1', email: 'test@example.com', role: 'USER', tokenId: 'token-uuid' };

      await service.logout(requestUser);

      expect(mockUsersService.deleteRefreshToken).toHaveBeenCalledWith('token-uuid');
    });
  });

  describe('sendPasswordResetEmail (發送密碼重設郵件)', () => {
    it('若信箱存在，應產生驗證碼並發送郵件', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce({ id: '1', email: 'test@example.com' });
      mockVerificationCodeService.generateCode.mockResolvedValueOnce('123456');
      mockEmailService.send.mockResolvedValueOnce(undefined);

      const result = await service.sendPasswordResetEmail('test@example.com');
      expect(result).toHaveProperty('message', '重設驗證碼已成功寄出');
      expect(mockVerificationCodeService.generateCode).toHaveBeenCalledWith('password_reset', 'test@example.com');
      expect(mockEmailService.send).toHaveBeenCalled();
    });

    it('資安優化：若信箱不存在，仍應回傳成功訊息，但不發信與產生驗證碼', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(null);

      const result = await service.sendPasswordResetEmail('notfound@example.com');
      expect(result).toHaveProperty('message', '重設驗證碼已成功寄出');
      expect(mockVerificationCodeService.generateCode).not.toHaveBeenCalled();
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword (驗證並重設密碼)', () => {
    it('若驗證碼正確且用戶存在，應更新密碼並撤銷所有既有 Refresh Token', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce({ id: '1', email: 'test@example.com' });
      mockVerificationCodeService.verifyCode.mockResolvedValueOnce(undefined);
      mockUsersService.update.mockResolvedValueOnce({ id: '1' });
      mockUsersService.deleteUserRefreshTokens.mockResolvedValueOnce({ count: 2 });

      const result = await service.resetPassword('test@example.com', '123456', 'NewPassword123');
      expect(result).toHaveProperty('message', '密碼已成功重設');
      expect(mockVerificationCodeService.verifyCode).toHaveBeenCalledWith('password_reset', 'test@example.com', '123456');
      expect(mockUsersService.update).toHaveBeenCalledWith('1', { password: 'NewPassword123' });
      expect(mockUsersService.deleteUserRefreshTokens).toHaveBeenCalledWith('1');
    });

    it('若驗證碼錯誤或過期，應拋出 BadRequestException 錯誤', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce({ id: '1', email: 'test@example.com' });
      mockVerificationCodeService.verifyCode.mockRejectedValueOnce(new BadRequestException('驗證碼無效或已過期'));

      await expect(
        service.resetPassword('test@example.com', 'invalid-code', 'NewPassword123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('若用戶不存在，應拋出 NotFoundException 錯誤', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(null);

      await expect(
        service.resetPassword('notfound@example.com', '123456', 'NewPassword123'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
