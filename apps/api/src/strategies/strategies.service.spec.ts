import { Test, TestingModule } from '@nestjs/testing';
import { StrategiesService } from './strategies.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('StrategiesService', () => {
  let service: StrategiesService;

  const mockPrismaClient = {
    savedStrategy: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrategiesService,
        {
          provide: ExtendedPrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
      ],
    }).compile();

    service = module.get<StrategiesService>(StrategiesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('StrategiesService 應該被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const userId = 'user-1';
    const createDto = {
      name: '策略A',
      config: {
        timeframes: [],
      },
    };

    it('應成功建立新策略', async () => {
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValue(null); // 沒有重名策略
      mockPrismaClient.savedStrategy.create.mockResolvedValue({
        id: 'strat-1',
        userId,
        name: '策略A',
        config: createDto.config,
      });

      const result = await service.create(userId, createDto);

      expect(mockPrismaClient.savedStrategy.findUnique).toHaveBeenCalled();
      expect(mockPrismaClient.savedStrategy.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: '策略A',
          config: createDto.config,
        },
      });
      expect(result).toHaveProperty('id', 'strat-1');
    });

    it('同名策略已存在時應拋出 ConflictException', async () => {
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValue({
        id: 'existing-id',
        userId,
        name: '策略A',
      });

      await expect(service.create(userId, createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('應回傳用戶所有儲存的策略', async () => {
      const userId = 'user-1';
      const mockList = [
        { id: 'strat-1', name: '策略1', config: {} },
        { id: 'strat-2', name: '策略2', config: {} },
      ];
      mockPrismaClient.savedStrategy.findMany.mockResolvedValue(mockList);

      const result = await service.findAll(userId);

      expect(mockPrismaClient.savedStrategy.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('remove', () => {
    const userId = 'user-1';
    const strategyId = 'strat-1';

    it('應成功刪除擁有權屬於自己的策略', async () => {
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValue({
        id: strategyId,
        userId,
        name: '我的策略',
      });
      mockPrismaClient.savedStrategy.delete.mockResolvedValue({});

      const result = await service.remove(userId, strategyId);

      expect(mockPrismaClient.savedStrategy.delete).toHaveBeenCalledWith({
        where: { id: strategyId },
      });
      expect(result).toEqual({ message: '策略已刪除' });
    });

    it('若策略不存在應拋出 NotFoundException', async () => {
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValue(null);

      await expect(service.remove(userId, strategyId)).rejects.toThrow(NotFoundException);
    });

    it('若刪除他人策略應拋出 NotFoundException', async () => {
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValue({
        id: strategyId,
        userId: 'other-user', // 他人的策略
        name: '他人的策略',
      });

      await expect(service.remove(userId, strategyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const userId = 'user-1';
    const strategyId = 'strat-1';
    const updateDto = {
      name: '新策略名稱',
      config: {
        timeframes: [],
        category: '多頭',
      },
    };

    it('應成功更新擁有權屬於自己的策略', async () => {
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValueOnce({
        id: strategyId,
        userId,
        name: '舊策略名稱',
      });
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValueOnce(null);
      mockPrismaClient.savedStrategy.update.mockResolvedValue({
        id: strategyId,
        userId,
        name: '新策略名稱',
        config: updateDto.config,
      });

      const result = await service.update(userId, strategyId, updateDto);

      expect(mockPrismaClient.savedStrategy.update).toHaveBeenCalledWith({
        where: { id: strategyId },
        data: {
          name: '新策略名稱',
          config: updateDto.config,
        },
      });
      expect(result).toHaveProperty('name', '新策略名稱');
    });

    it('若更新的名稱與其他同名策略衝突應拋出 ConflictException', async () => {
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValueOnce({
        id: strategyId,
        userId,
        name: '舊策略名稱',
      });
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValueOnce({
        id: 'other-strat-id',
        userId,
        name: '新策略名稱',
      });

      await expect(service.update(userId, strategyId, updateDto)).rejects.toThrow(ConflictException);
    });

    it('若策略不存在應拋出 NotFoundException', async () => {
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValue(null);

      await expect(service.update(userId, strategyId, updateDto)).rejects.toThrow(NotFoundException);
    });

    it('若更新他人策略應拋出 NotFoundException', async () => {
      mockPrismaClient.savedStrategy.findUnique.mockResolvedValue({
        id: strategyId,
        userId: 'other-user',
        name: '他人的策略',
      });

      await expect(service.update(userId, strategyId, updateDto)).rejects.toThrow(NotFoundException);
    });
  });
});
