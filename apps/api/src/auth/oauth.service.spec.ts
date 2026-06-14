import { Test, TestingModule } from '@nestjs/testing';
import { OAuthService } from './oauth.service';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';

describe('OAuthService (第三方認證服務)', () => {
  let service: OAuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshTokenById: jest.fn(),
    deleteRefreshToken: jest.fn(),
    deleteUserRefreshTokens: jest.fn(),
  };

  const mockAuthService = {
    login: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'JWT_SECRET') return 'test-jwt-secret';
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
      if (key === 'TELEGRAM_BOT_TOKEN') return '123456:fake-token';
      return null;
    }),
  };

  const mockPrisma = {
    client: {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    },
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
        OAuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ExtendedPrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<OAuthService>(OAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('服務應該要被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('handleOAuthLoginOrLink', () => {
    it('若用戶已存在則直接登入', async () => {
      const user = { id: 'user-id-123', googleId: 'google-sub' };
      mockPrisma.client.user.findFirst.mockResolvedValue(user);

      const result = await service.handleOAuthLoginOrLink('google', { sub: 'google-sub', name: 'Social User' });
      expect(result).toEqual(user);
      expect(mockPrisma.client.user.findFirst).toHaveBeenCalledWith({
        where: { googleId: 'google-sub' },
      });
    });

    it('若用戶不存在但 Email 相同，則關聯該帳號並登入', async () => {
      const existingUser = { id: 'user-id-123', email: 'test@example.com' };
      mockPrisma.client.user.findFirst.mockResolvedValueOnce(null); // by googleId
      mockPrisma.client.user.findUnique.mockResolvedValueOnce(existingUser); // by email
      mockPrisma.client.user.update.mockResolvedValue({ ...existingUser, googleId: 'google-sub' });

      const result = await service.handleOAuthLoginOrLink('google', { sub: 'google-sub', email: 'test@example.com', name: 'Social User' });
      expect(result.googleId).toBe('google-sub');
      expect(mockPrisma.client.user.update).toHaveBeenCalled();
    });

    it('若用戶與 Email 皆不存在，則自動註冊新帳號', async () => {
      mockPrisma.client.user.findFirst.mockResolvedValueOnce(null); // by googleId
      mockPrisma.client.user.findUnique.mockResolvedValueOnce(null); // by email
      mockPrisma.client.user.create.mockResolvedValue({ id: 'new-user', googleId: 'google-sub', email: 'new@example.com' });

      const result = await service.handleOAuthLoginOrLink('google', { sub: 'google-sub', email: 'new@example.com', name: 'Social User' });
      expect(result.id).toBe('new-user');
      expect(mockPrisma.client.user.create).toHaveBeenCalled();
    });

    it('若帶有 stateUserId 則執行綁定流程', async () => {
      const user = { id: 'user-id-123' };
      mockPrisma.client.user.findUnique.mockResolvedValueOnce(user); // find user by id
      mockPrisma.client.user.findFirst.mockResolvedValueOnce(null); // check conflict
      mockPrisma.client.user.update.mockResolvedValue({ ...user, googleId: 'google-sub' });

      const result = await service.handleOAuthLoginOrLink('google', { sub: 'google-sub', name: 'Social User' }, 'user-id-123');
      expect(result.googleId).toBe('google-sub');
    });
  });

  describe('validateTelegramAuth', () => {
    it('正確的 Telegram 雜湊驗證應通過', () => {
      const now = Math.floor(Date.now() / 1000);
      const dto = {
        id: 12345,
        first_name: 'Ming',
        auth_date: now,
        hash: '',
      };

      const secretKey = createHash('sha256').update('123456:fake-token').digest();
      const checkParams = `auth_date=${dto.auth_date}\nfirst_name=Ming\nid=12345`;
      dto.hash = createHmac('sha256', secretKey).update(checkParams).digest('hex');

      const result = service.validateTelegramAuth(dto);
      expect(result).toBe(true);
    });

    it('錯誤的 Telegram 雜湊驗證應拋出 UnauthorizedException', () => {
      const dto = {
        id: 12345,
        first_name: 'Ming',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'invalid-hash-value',
      };

      expect(() => service.validateTelegramAuth(dto)).toThrow(UnauthorizedException);
    });

    it('已過期的驗證時間應拋出 UnauthorizedException', () => {
      const dto = {
        id: 12345,
        first_name: 'Ming',
        auth_date: Math.floor(Date.now() / 1000) - 90000, // 25 小時前
        hash: 'some-hash',
      };

      expect(() => service.validateTelegramAuth(dto)).toThrow(UnauthorizedException);
    });
  });

  describe('unlinkProvider', () => {
    it('當用戶擁有其他登入方式時，應能成功解綁', async () => {
      const user = { id: 'user-id-123', password: 'hashed-password', googleId: 'google-sub' };
      mockPrisma.client.user.findUnique.mockResolvedValueOnce(user);
      mockPrisma.client.user.update.mockResolvedValue({ ...user, googleId: null });

      const result = await service.unlinkProvider('user-id-123', 'google');
      expect(result.googleId).toBeNull();
    });

    it('當解綁為最後一個登入方式時，應拋出 BadRequestException 阻止解綁', async () => {
      const user = { id: 'user-id-123', password: null, googleId: 'google-sub', discordId: null, telegramId: null };
      mockPrisma.client.user.findUnique.mockResolvedValueOnce(user);

      await expect(service.unlinkProvider('user-id-123', 'google')).rejects.toThrow(BadRequestException);
    });
  });
});
