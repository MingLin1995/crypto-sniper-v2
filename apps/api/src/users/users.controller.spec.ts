import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController (用戶控制器)', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockRequestWithUser: any = {
    user: {
      sub: 'user-123',
      email: 'test@example.com',
      role: 'ADMIN',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            findAll: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  it('getProfile 應取得當前登入用戶資訊', async () => {
    const user = { id: 'user-123', email: 'test@example.com' };
    usersService.findOne.mockResolvedValue(user as any);

    const result = await controller.getProfile(mockRequestWithUser);

    expect(usersService.findOne).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(user);
  });

  it('updateProfile 應更新當前登入用戶資訊', async () => {
    const updateDto = { nickname: 'NewName' };
    usersService.update.mockResolvedValue({ id: 'user-123', ...updateDto } as any);

    const result = await controller.updateProfile(mockRequestWithUser, updateDto as any);

    expect(usersService.update).toHaveBeenCalledWith('user-123', updateDto);
    expect(result.nickname).toBe('NewName');
  });

  it('findAll 應查詢所有用戶列表 (ADMIN)', async () => {
    const query = { page: 1, limit: 10 };
    usersService.findAll.mockResolvedValue({ data: [], meta: {} as any } as any);

    const result = await controller.findAll(query as any);

    expect(usersService.findAll).toHaveBeenCalledWith(query);
    expect(result.data).toBeDefined();
  });

  it('remove 應軟刪除指定用戶 (ADMIN)', async () => {
    usersService.remove.mockResolvedValue({ message: 'User removed successfully' } as any);

    const result = await controller.remove('user-target');

    expect(usersService.remove).toHaveBeenCalledWith('user-target');
    expect(result.message).toBe('User removed successfully');
  });
});
