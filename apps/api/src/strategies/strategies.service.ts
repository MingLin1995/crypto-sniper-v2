import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { UpdateStrategyDto } from './dto/update-strategy.dto';

@Injectable()
export class StrategiesService {
  constructor(private readonly prisma: ExtendedPrismaService) {}

  /**
   * 建立並儲存策略
   */
  async create(userId: string, dto: CreateStrategyDto) {
    // 檢查同名策略是否存在
    const existing = await this.prisma.client.savedStrategy.findUnique({
      where: {
        userId_name: {
          userId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException('已存在同名的儲存策略');
    }

    return this.prisma.client.savedStrategy.create({
      data: {
        userId,
        name: dto.name,
        config: dto.config as any, // 轉型為 Prisma JSON type
      },
    });
  }

  /**
   * 取得用戶所有策略
   */
  async findAll(userId: string) {
    return this.prisma.client.savedStrategy.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * 更新特定策略
   */
  async update(userId: string, id: string, dto: UpdateStrategyDto) {
    const strategy = await this.prisma.client.savedStrategy.findUnique({
      where: {
        id,
      },
    });

    if (!strategy) {
      throw new NotFoundException('找不到該策略');
    }

    if (strategy.userId !== userId) {
      throw new NotFoundException('找不到該策略');
    }

    // 若變更策略名稱，檢查同名衝突
    if (dto.name && dto.name !== strategy.name) {
      const existing = await this.prisma.client.savedStrategy.findUnique({
        where: {
          userId_name: {
            userId,
            name: dto.name,
          },
        },
      });
      if (existing) {
        throw new ConflictException('已存在同名的儲存策略');
      }
    }

    return this.prisma.client.savedStrategy.update({
      where: {
        id,
      },
      data: {
        name: dto.name !== undefined ? dto.name : undefined,
        config: dto.config !== undefined ? (dto.config as any) : undefined,
      },
    });
  }

  /**
   * 刪除特定策略
   */
  async remove(userId: string, id: string) {
    const strategy = await this.prisma.client.savedStrategy.findUnique({
      where: {
        id,
      },
    });

    if (!strategy) {
      throw new NotFoundException('找不到該策略');
    }

    if (strategy.userId !== userId) {
      throw new NotFoundException('找不到該策略'); // 防止越權操作
    }

    await this.prisma.client.savedStrategy.delete({
      where: {
        id,
      },
    });

    return { message: '策略已刪除' };
  }
}
