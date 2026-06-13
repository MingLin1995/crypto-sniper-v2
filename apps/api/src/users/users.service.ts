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
  async findByAccount(account: string) {
    return this.prisma.client.user.findFirst({
      where: {
        account,
      },
    });
  }

  async create(registerDto: RegisterDto) {
    const existingUser = await this.prisma.client.user.findUnique({
      where: { account: registerDto.account },
    });

    if (existingUser) {
      throw new ConflictException('帳號已存在');
    }

    const existingEmail = await this.prisma.client.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email 已被使用');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const userData = {
      ...registerDto,
      password: hashedPassword,
      role: Role.USER,
    };

    return this.prisma.client.user.create({
      data: userData,
      omit: { password: true },
    });
  }

  async createSocialUser(data: {
    account: string;
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

    const existingUser = await this.prisma.client.user.findUnique({
      where: { account: data.account },
    });
    if (existingUser) {
      throw new ConflictException('帳號已存在');
    }

    return this.prisma.client.user.create({
      data: {
        account: data.account,
        email: data.email,
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
      // 帳號搜尋（模糊搜尋，不區分大小寫）
      ...(queryDto.account && {
        account: {
          contains: queryDto.account,
          mode: 'insensitive',
        },
      }),
      // Email 搜尋（模糊搜尋，不區分大小寫）
      ...(queryDto.email && {
        email: {
          contains: queryDto.email,
          mode: 'insensitive',
        },
      }),
      // 電話搜尋（模糊搜尋）
      ...(queryDto.phone && {
        phone: {
          contains: queryDto.phone,
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

    await this.prisma.client.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        account: `${user.account}_deleted_${Date.now()}`,
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
