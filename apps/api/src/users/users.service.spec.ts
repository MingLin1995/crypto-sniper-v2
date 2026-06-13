import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { ConflictException } from '@nestjs/common';
import { Role } from '../common/decorators/roles.decorator';

describe('UsersService (使用者服務)', () => {
  let service: UsersService;

  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: ExtendedPrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('服務應該要被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('create (註冊新使用者)', () => {
    const registerDto = {
      account: 'testuser',
      password: 'Password123',
      email: 'test@example.com',
    };

    it('應該要能成功註冊新使用者', async () => {
      mockPrismaClient.user.findUnique
        .mockResolvedValueOnce(null) // 檢查帳號是否存在
        .mockResolvedValueOnce(null); // 檢查 Email 是否存在

      mockPrismaClient.user.create.mockResolvedValue({
        id: 'user-id',
        account: 'testuser',
        email: 'test@example.com',
        role: Role.USER,
      });

      const result = await service.create(registerDto);

      expect(mockPrismaClient.user.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'user-id');
    });

    it('如果帳號已存在，應該要拋出 ConflictException 錯誤', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValueOnce({ id: 'existing' });

      await expect(service.create(registerDto)).rejects.toThrow(ConflictException);
    });

    it('如果 Email 已被使用，應該要拋出 ConflictException 錯誤', async () => {
      mockPrismaClient.user.findUnique
        .mockResolvedValueOnce(null) // 帳號不存在
        .mockResolvedValueOnce({ id: 'existing' }); // Email 已存在

      await expect(service.create(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('createSocialUser (建立第三方快速登入使用者)', () => {
    const socialUserData = {
      account: 'google_user',
      email: 'google@example.com',
      googleId: 'google-12345',
    };

    it('應該要能成功建立不帶密碼的第三方使用者', async () => {
      mockPrismaClient.user.findUnique
        .mockResolvedValueOnce(null) // 檢查 Email
        .mockResolvedValueOnce(null); // 檢查帳號

      mockPrismaClient.user.create.mockResolvedValue({
        id: 'social-user-id',
        account: 'google_user',
        email: 'google@example.com',
        googleId: 'google-12345',
        role: Role.USER,
      });

      const result = await service.createSocialUser(socialUserData);

      expect(mockPrismaClient.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            account: 'google_user',
            googleId: 'google-12345',
          }),
        }),
      );
      expect(result).toHaveProperty('id', 'social-user-id');
    });
  });
});
