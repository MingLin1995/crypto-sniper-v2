import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '../common/decorators/roles.decorator';
import { VerificationCodeService } from '../auth/verification-code.service';
import * as bcrypt from 'bcrypt';

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

  const mockVerificationCodeService = {
    verifyCode: jest.fn(),
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
        {
          provide: VerificationCodeService,
          useValue: mockVerificationCodeService,
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
      password: 'Password123',
      email: 'test@example.com',
      nickname: '測試暱稱',
    };

    it('應該要能成功註冊新使用者', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null); // 檢查 Email 是否存在

      mockPrismaClient.user.create.mockResolvedValue({
        id: 'user-id',
        nickname: '測試暱稱',
        email: 'test@example.com',
        role: Role.USER,
      });

      const result = await service.create(registerDto);

      expect(mockPrismaClient.user.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'user-id');
    });

    it('如果 Email 已被使用，應該要拋出 ConflictException 錯誤', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValueOnce({ id: 'existing' }); // Email 已存在

      await expect(service.create(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne (查詢使用者)', () => {
    it('應該要能成功回傳使用者資訊並標記 hasPassword: true', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValueOnce({
        id: 'user-id',
        email: 'test@example.com',
        nickname: '測試',
        password: 'hashedpassword',
      });

      const result = await service.findOne('user-id');
      expect(result).toHaveProperty('hasPassword', true);
      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe('user-id');
    });

    it('如果使用者密碼為空（第三方登入），應該要標記 hasPassword: false', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValueOnce({
        id: 'user-id',
        email: 'test@example.com',
        nickname: '測試',
        password: null,
      });

      const result = await service.findOne('user-id');
      expect(result).toHaveProperty('hasPassword', false);
      expect(result).not.toHaveProperty('password');
    });

    it('如果使用者不存在，應該要拋出 NotFoundException', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update (更新使用者資訊)', () => {
    const updateUserDto = {
      email: 'new-email@example.com',
      nickname: '新暱稱',
      code: '123456',
    };

    it('應該要能成功更新使用者資訊', async () => {
      const user = { id: 'user-id', email: 'old-email@example.com' };
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(user); // find user by id
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(null); // find duplicate email (none)
      mockVerificationCodeService.verifyCode.mockResolvedValueOnce(undefined); // mock successful code verification
 
      mockPrismaClient.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'new-email@example.com',
        nickname: '新暱稱',
      });
 
      const result = await service.update('user-id', updateUserDto);
      expect(result.email).toBe('new-email@example.com');
      expect(mockPrismaClient.user.update).toHaveBeenCalled();
      expect(mockVerificationCodeService.verifyCode).toHaveBeenCalledWith('email_verify', 'new-email@example.com', '123456');
    });

    it('如果更新的新 Email 已被其他用戶使用，應該要拋出 ConflictException 錯誤', async () => {
      const user = { id: 'user-id', email: 'old-email@example.com' };
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(user); // find user by id
      mockPrismaClient.user.findFirst.mockResolvedValueOnce({ id: 'other-user-id' }); // find duplicate email (exists)

      await expect(service.update('user-id', updateUserDto)).rejects.toThrow(ConflictException);
    });

    it('如果更新信箱但未提供驗證碼，應該要拋出 BadRequestException', async () => {
      const user = { id: 'user-id', email: 'old-email@example.com' };
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(user); // find user by id
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(null); // find duplicate email (none)

      const dtoWithoutCode = { ...updateUserDto, code: undefined };
      await expect(service.update('user-id', dtoWithoutCode)).rejects.toThrow(BadRequestException);
    });

    it('如果更新信箱但驗證碼錯誤或過期，應該要拋出 BadRequestException', async () => {
      const user = { id: 'user-id', email: 'old-email@example.com' };
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(user); // find user by id
      mockPrismaClient.user.findFirst.mockResolvedValueOnce(null); // find duplicate email (none)
      mockVerificationCodeService.verifyCode.mockRejectedValueOnce(new BadRequestException('驗證碼無效或已過期'));
 
      await expect(service.update('user-id', updateUserDto)).rejects.toThrow(BadRequestException);
    });

    describe('更新密碼', () => {
      it('如果使用者原先沒有密碼，應能直接設定新密碼且不需驗證舊密碼', async () => {
        const user = { id: 'user-id', email: 'test@example.com', password: null };
        mockPrismaClient.user.findFirst.mockResolvedValueOnce(user);
        mockPrismaClient.user.update.mockResolvedValue({ id: 'user-id' });

        const dto = { password: 'newPassword123' };
        await service.update('user-id', dto);

        expect(mockPrismaClient.user.update).toHaveBeenCalled();
      });

      it('如果使用者有密碼但未提供舊密碼，應該要拋出 BadRequestException', async () => {
        const user = { id: 'user-id', email: 'test@example.com', password: 'hashedpassword' };
        mockPrismaClient.user.findFirst.mockResolvedValueOnce(user);

        const dto = { password: 'newPassword123' };
        await expect(service.update('user-id', dto)).rejects.toThrow(BadRequestException);
      });

      it('如果提供了舊密碼但驗證失敗，應該要拋出 BadRequestException', async () => {
        const user = { id: 'user-id', email: 'test@example.com', password: 'hashedpassword' };
        mockPrismaClient.user.findFirst.mockResolvedValueOnce(user);

        // Spy on bcrypt.compare to return false
        jest.spyOn(bcrypt, 'compare').mockImplementationOnce(() => Promise.resolve(false));

        const dto = { password: 'newPassword123', currentPassword: 'wrongPassword' };
        await expect(service.update('user-id', dto)).rejects.toThrow(BadRequestException);
      });

      it('如果提供了正確的舊密碼，應該要成功更新密碼且撤銷 Refresh Token', async () => {
        const user = { id: 'user-id', email: 'test@example.com', password: 'hashedpassword' };
        mockPrismaClient.user.findFirst.mockResolvedValueOnce(user);
        mockPrismaClient.user.update.mockResolvedValue({ id: 'user-id' });

        jest.spyOn(bcrypt, 'compare').mockImplementationOnce(() => Promise.resolve(true));
        jest.spyOn(bcrypt, 'hash').mockImplementationOnce(() => Promise.resolve('new-hashed-password'));

        const dto = { password: 'newPassword123', currentPassword: 'correctPassword' };
        await service.update('user-id', dto);

        expect(mockPrismaClient.user.update).toHaveBeenCalled();
        expect(mockPrismaClient.refreshToken.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'user-id' },
        });
      });
    });
  });
});
