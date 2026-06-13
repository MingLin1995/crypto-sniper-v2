import { Injectable } from '@nestjs/common';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { Prisma } from '@prisma/client';
import { LogQueryDto } from './dto/log-query.dto';
import { calculatePagination, createPaginatedResponse } from '../common/utils/pagination.helper';

@Injectable()
export class LogsService {
  constructor(private prisma: ExtendedPrismaService) { }

  async findAll(queryDto: LogQueryDto) {
    const { skip, take } = calculatePagination(queryDto);
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 10;

    const where: Prisma.SystemLogWhereInput = {
      // 日誌等級篩選
      ...(queryDto.level && { level: queryDto.level }),

      // 日誌類型篩選
      ...(queryDto.type && { type: queryDto.type }),

      // 用戶 ID 篩選
      ...(queryDto.userId && { userId: queryDto.userId }),

      // 用戶帳號篩選
      ...(queryDto.userAccount && {
        userAccount: {
          contains: queryDto.userAccount,
          mode: 'insensitive',
        },
      }),

      // HTTP 狀態碼篩選
      ...(queryDto.statusCode && { statusCode: queryDto.statusCode }),

      // HTTP 方法篩選
      ...(queryDto.method && { method: queryDto.method }),

      // 客戶端 IP 篩選
      ...(queryDto.clientIp && {
        clientIp: {
          contains: queryDto.clientIp,
        },
      }),

      // 關鍵字搜尋（搜尋 message 欄位）
      ...(queryDto.keyword && {
        message: {
          contains: queryDto.keyword,
          mode: 'insensitive',
        },
      }),

      // 時間範圍篩選
      ...(queryDto.startDate &&
        queryDto.endDate && {
        createdAt: {
          gte: new Date(queryDto.startDate),
          lte: new Date(queryDto.endDate),
        },
      }),
      ...(queryDto.startDate &&
        !queryDto.endDate && {
        createdAt: {
          gte: new Date(queryDto.startDate),
        },
      }),
      ...(!queryDto.startDate &&
        queryDto.endDate && {
        createdAt: {
          lte: new Date(queryDto.endDate),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.systemLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.systemLog.count({ where }),
    ]);

    return createPaginatedResponse(data, page, limit, total);
  }

  async deleteOldLogs(days: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.client.systemLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return {
      message: `已刪除 ${days} 天前的日誌`,
      deletedCount: result.count,
    };
  }
}
