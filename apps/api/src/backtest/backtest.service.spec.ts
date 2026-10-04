import { Test, TestingModule } from '@nestjs/testing';
import { BacktestService } from './backtest.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateBacktestDto } from './dto/backtest.dto';

describe('BacktestService (回測排程服務)', () => {
  let service: BacktestService;
  let mockPrisma: any;
  let mockQueue: any;

  beforeEach(async () => {
    mockPrisma = {
      client: {
        backtestJob: {
          findFirst: jest.fn(),
          create: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
          findMany: jest.fn(),
          delete: jest.fn(),
        },
      },
    };

    mockQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacktestService,
        { provide: ExtendedPrismaService, useValue: mockPrisma },
        { provide: getQueueToken('backtest'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<BacktestService>(BacktestService);
  });

  it('服務應該要被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('createJob', () => {
    const validDto: CreateBacktestDto = {
      symbols: ['BTCUSDT'],
      interval: '15m',
      startTime: 1000,
      endTime: 1000 + 15 * 60 * 1000 * 10, // 10 bars
      leverage: 10,
      positionSizingMode: 'FIXED_PERCENT',
      timeframes: [
        {
          interval: '15m',
          conditions: [],
        },
      ],
    };

    it('若使用者已有 pending 狀態的回測，應拋出 ConflictException', async () => {
      mockPrisma.client.backtestJob.findFirst.mockResolvedValue({ id: 'existing-job-id', status: 'PENDING' });

      await expect(service.createJob('user-1', validDto)).rejects.toThrow(ConflictException);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('若回測時間範圍大於限制上限 (如大於 5 年)，應拋出 BadRequestException', async () => {
      mockPrisma.client.backtestJob.findFirst.mockResolvedValue(null);
      const invalidDto = {
        ...validDto,
        endTime: validDto.startTime + 6 * 365 * 24 * 60 * 60 * 1000, // 6 years (> 5 years limit)
      };

      await expect(service.createJob('user-1', invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('成功發起時，應寫入 PENDING 任務並推入 Queue 佇列', async () => {
      mockPrisma.client.backtestJob.findFirst.mockResolvedValue(null);
      mockPrisma.client.backtestJob.create.mockResolvedValue({
        id: 'new-job-id',
        status: 'PENDING',
        createdAt: new Date(),
      });

      const result = await service.createJob('user-1', validDto);

      expect(mockPrisma.client.backtestJob.create).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith('run-backtest', { jobId: 'new-job-id' });
      expect(result.id).toBe('new-job-id');
      expect(result.status).toBe('PENDING');
    });
  });

  describe('getJob', () => {
    it('若任務不存在或非該使用者所有，應拋出 NotFoundException', async () => {
      mockPrisma.client.backtestJob.findUnique.mockResolvedValue(null);

      await expect(service.getJob('user-1', 'job-id')).rejects.toThrow(NotFoundException);
    });

    it('若任務存在且屬於該使用者，應回傳任務詳情與佇列位置', async () => {
      const mockJob = {
        id: 'job-id',
        userId: 'user-1',
        status: 'PENDING',
        config: {},
        result: null,
        error: null,
      };
      mockPrisma.client.backtestJob.findUnique.mockResolvedValue(mockJob);
      mockQueue.getJobs.mockResolvedValue([
        { data: { jobId: 'another-job' } },
        { data: { jobId: 'job-id' } },
      ]);

      const result = await service.getJob('user-1', 'job-id');

      expect(result.id).toBe('job-id');
      expect(result.queuePosition).toBe(2); // 第二順位
    });
  });

  describe('deleteJob', () => {
    it('若任務不存在或非該使用者所有，應拋出 NotFoundException', async () => {
      mockPrisma.client.backtestJob.findUnique.mockResolvedValue(null);
      await expect(service.deleteJob('user-1', 'job-id')).rejects.toThrow(NotFoundException);
    });

    it('若任務處於 PENDING 或 RUNNING 狀態，應拋出 BadRequestException', async () => {
      mockPrisma.client.backtestJob.findUnique.mockResolvedValue({
        id: 'job-id',
        userId: 'user-1',
        status: 'RUNNING',
        createdAt: new Date(),
      });
      await expect(service.deleteJob('user-1', 'job-id')).rejects.toThrow(BadRequestException);
    });

    it('成功刪除已完成的任務', async () => {
      mockPrisma.client.backtestJob.findUnique.mockResolvedValue({
        id: 'job-id',
        userId: 'user-1',
        status: 'COMPLETED',
      });
      mockPrisma.client.backtestJob.delete.mockResolvedValue({ id: 'job-id' });

      const res = await service.deleteJob('user-1', 'job-id');
      expect(res.success).toBe(true);
      expect(mockPrisma.client.backtestJob.delete).toHaveBeenCalledWith({ where: { id: 'job-id' } });
    });
  });
});
