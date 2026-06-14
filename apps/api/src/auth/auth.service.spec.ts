import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService (認證服務)', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
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
});
