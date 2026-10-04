import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { CreateBacktestDto } from './dto/backtest.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BacktestService {
  constructor(
    private readonly prisma: ExtendedPrismaService,
    @InjectQueue('backtest') private readonly backtestQueue: Queue,
  ) {}

  /**
   * 發起回測任務
   */
  async createJob(userId: string, dto: CreateBacktestDto) {
    // 1. 防濫用機制：限制單一使用者同時只能有 1 個 PENDING 或 RUNNING 狀態的任務
    const activeJob = await this.prisma.client.backtestJob.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (activeJob) {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (new Date(activeJob.createdAt).getTime() < fiveMinutesAgo) {
        // 自動修復被中斷/孤立的超時任務
        await this.prisma.client.backtestJob.update({
          where: { id: activeJob.id },
          data: {
            status: 'FAILED',
            error: 'Job timed out or worker crashed/restarted.',
            completedAt: new Date(),
          },
        });
      } else {
        throw new ConflictException({
          message: 'You already have a pending or running backtest job.',
          jobId: activeJob.id,
          status: activeJob.status,
        });
      }
    }

    // 2. 時間長度限制驗證
    this.validateTimeRange(dto.startTime, dto.endTime);

    // 3. 填入預設值
    const config = {
      strategyId: dto.strategyId,
      strategyName: dto.strategyName,
      symbols: dto.symbols.map(s => s.toUpperCase()),
      interval: dto.interval,
      startTime: dto.startTime,
      endTime: dto.endTime,
      leverage: dto.leverage,
      takerFeeRate: dto.takerFeeRate ?? 0.0004,
      makerFeeRate: dto.makerFeeRate ?? 0.0002,
      slippage: dto.slippage ?? 0.05,
      // Core Simple Risk & Exit Rules
      slPercent: dto.slPercent ?? 5.0,
      tpPercent: dto.tpPercent,
      useSignalExit: dto.useSignalExit ?? true,
      exitConditionMode: dto.exitConditionMode ?? (dto.useSignalExit === false ? 'NONE' : 'AUTO_REVERSE'),
      exitConditions: dto.exitConditions ?? [],

      initialBalance: dto.initialBalance ?? 10000,
      fundingRate: dto.fundingRate ?? 0.0001,
      positionSizingMode: dto.positionSizingMode,
      fixedMarginPercent: dto.fixedMarginPercent ?? 10,
      riskPercentPerTrade: dto.riskPercentPerTrade ?? 1,
      maxPositions: dto.maxPositions ?? 5,
      timeframes: dto.timeframes,
    };

    // 4. 寫入 DB 任務紀錄 (狀態: PENDING)
    const job = await this.prisma.client.backtestJob.create({
      data: {
        userId,
        status: 'PENDING',
        config: config as unknown as Prisma.InputJsonValue,
      },
    });

    // 5. 推入 BullMQ 佇列非同步執行
    await this.backtestQueue.add('run-backtest', { jobId: job.id });

    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
    };
  }

  /**
   * 查詢單筆回測狀態與結果
   */
  async getJob(userId: string, id: string) {
    const job = await this.prisma.client.backtestJob.findUnique({
      where: { id },
    });

    if (!job || job.userId !== userId) {
      throw new NotFoundException('Backtest job not found');
    }

    // 估計等待時間或佇列位置
    let queuePosition: number | null = null;
    if (job.status === 'PENDING') {
      const bullJobs = await this.backtestQueue.getJobs(['waiting', 'delayed', 'paused']);
      const idx = bullJobs.findIndex(bj => bj.data?.jobId === id);
      if (idx !== -1) {
        queuePosition = idx + 1;
      }
    }

    return {
      id: job.id,
      status: job.status,
      config: job.config,
      result: job.result,
      error: job.error,
      queuePosition,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    };
  }

  /**
   * 查詢使用者歷史回測紀錄 (分頁)
   */
  async getHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.client.backtestJob.count({ where: { userId } }),
      this.prisma.client.backtestJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          config: true,
          error: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteJob(userId: string, id: string) {
    const job = await this.prisma.client.backtestJob.findUnique({
      where: { id },
    });

    if (!job || job.userId !== userId) {
      throw new NotFoundException('Backtest job not found');
    }

    if (job.status === 'PENDING' || job.status === 'RUNNING') {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (new Date(job.createdAt).getTime() >= fiveMinutesAgo) {
        throw new BadRequestException('Cannot delete an active backtest job');
      }
    }

    await this.prisma.client.backtestJob.delete({
      where: { id },
    });

    return { success: true };
  }

  private validateTimeRange(startTime: number, endTime: number): void {
    const duration = endTime - startTime;
    if (duration <= 0) {
      throw new BadRequestException('Start time must be before end time');
    }

    const oneDay = 24 * 60 * 60 * 1000;
    const maxDuration = 5 * 365 * oneDay; // 5 years

    if (duration > maxDuration) {
      throw new BadRequestException(
        'Backtest range cannot exceed 5 years (1825 days).',
      );
    }
  }
}
