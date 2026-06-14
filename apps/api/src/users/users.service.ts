import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { Prisma } from '@prisma/client';
import { RegisterDto } from '../auth/dto/auth.dto';
import { UpdateUserDto } from './dto/user.dto';
import { Role } from '../common/decorators/roles.decorator';
import * as bcrypt from 'bcrypt';
import { UserQueryDto } from './dto/user-query.dto';
import { calculatePagination, createPaginatedResponse } from '../common/utils/pagination.helper';

@Injectable()
export class UsersService {
  constructor(private prisma: ExtendedPrismaService) { }

  async findByEmail(email: string) {
    return this.prisma.client.user.findFirst({
      where: {
        email,
      },
    });
  }

  async create(registerDto: Omit<RegisterDto, 'code'>) {
    const existingEmail = await this.prisma.client.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email 已被使用');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const userData = {
      email: registerDto.email,
      nickname: registerDto.nickname,
      password: hashedPassword,
      role: Role.USER,
    };

    return this.prisma.client.user.create({
      data: userData,
      omit: { password: true },
    });
  }

  async createSocialUser(data: {
    nickname: string;
    email?: string;
    googleId?: string;
    telegramId?: string;
    discordId?: string;
  }) {
    if (data.email) {
      const existingEmail = await this.prisma.client.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email 已被使用');
      }
    }

    return this.prisma.client.user.create({
      data: {
        nickname: data.nickname,
        email: data.email || null,
        googleId: data.googleId,
        telegramId: data.telegramId,
        discordId: data.discordId,
        role: Role.USER,
      },
      omit: { password: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id, },
      omit: { password: true },
    });

    if (!user) {
      throw new NotFoundException(`用戶不存在`);
    }

    return user;
  }

  async findAll(queryDto: UserQueryDto) {
    const { skip, take } = calculatePagination(queryDto);
    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 10;

    const where: Prisma.UserWhereInput = {
      // 暱稱搜尋
      ...(queryDto.nickname && {
        nickname: {
          contains: queryDto.nickname,
          mode: 'insensitive',
        },
      }),
      // Email 搜尋
      ...(queryDto.email && {
        email: {
          contains: queryDto.email,
          mode: 'insensitive',
        },
      }),
      // 角色篩選
      ...(queryDto.role && { role: queryDto.role }),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        skip,
        take,
        omit: { password: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return createPaginatedResponse(data, page, limit, total);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.client.user.findFirst({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`用戶不存在`);
    }

    const dataToUpdate = { ...updateUserDto };
    if (dataToUpdate.password) {
      dataToUpdate.password = await bcrypt.hash(dataToUpdate.password, 10);
      // 密碼變更時，撤銷該用戶所有裝置的 Refresh Token
      await this.deleteUserRefreshTokens(id);
    }

    return this.prisma.client.user.update({
      where: { id },
      data: dataToUpdate,
      omit: { password: true },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`用戶不存在`);
    }

    // 軟刪除：更新 deletedAt，並修改 email 以避免佔用唯一鍵
    await this.prisma.client.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        email: user.email ? `${user.email}_deleted_${Date.now()}` : null,
      },
    });

    // 軟刪除時，撤銷該用戶所有的 Refresh Token
    await this.deleteUserRefreshTokens(id);

    return { message: '用戶已刪除' };
  }

  async createRefreshToken(userId: string, token: string, expiresAt: Date, id?: string) {
    return this.prisma.client.refreshToken.create({
      data: {
        ...(id && { id }),
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findRefreshTokenById(id: string) {
    return this.prisma.client.refreshToken.findUnique({
      where: { id },
    });
  }

  async deleteRefreshToken(id: string) {
    return this.prisma.client.refreshToken.delete({
      where: { id },
    });
  }

  async deleteUserRefreshTokens(userId: string) {
    return this.prisma.client.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
