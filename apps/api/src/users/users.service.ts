import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { Prisma } from '@prisma/client';
import { RegisterDto } from '../auth/dto/auth.dto';
import { UpdateUserDto } from './dto/user.dto';
import { Role } from '../common/decorators/roles.decorator';
import * as bcrypt from 'bcrypt';
import { UserQueryDto } from './dto/user-query.dto';
import { calculatePagination, createPaginatedResponse } from '../common/utils/pagination.helper';
import { VerificationCodeService } from '../auth/verification-code.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: ExtendedPrismaService,
    private readonly verificationCodeService: VerificationCodeService,
  ) { }

  async findByEmail(email: string) {
    return this.prisma.client.user.findFirst({
      where: {
        email,
      },
      omit: {
        password: false,
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
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id },
      omit: { password: false },
    });

    if (!user) {
      throw new NotFoundException(`用戶不存在`);
    }

    const { password, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      hasPassword: !!password,
    };
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return createPaginatedResponse(data, page, limit, total);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.client.user.findFirst({
      where: { id },
      omit: { password: false },
    });

    if (!user) {
      throw new NotFoundException(`用戶不存在`);
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const emailExists = await this.prisma.client.user.findFirst({
        where: {
          email: updateUserDto.email,
          id: { not: id },
        },
      });
      if (emailExists) {
        throw new ConflictException('此電子信箱已被其他帳戶使用');
      }

      // 檢查驗證碼
      if (!updateUserDto.code) {
        throw new BadRequestException('更新電子信箱時需要提供驗證碼');
      }

      await this.verificationCodeService.verifyCode('email_verify', updateUserDto.email, updateUserDto.code);
    }

    if (updateUserDto.password) {
      if (user.password) {
        if (!updateUserDto.currentPassword) {
          throw new BadRequestException('請提供當前舊密碼以驗證身分');
        }
        const isCurrentPasswordValid = await bcrypt.compare(
          updateUserDto.currentPassword,
          user.password,
        );
        if (!isCurrentPasswordValid) {
          throw new BadRequestException('當前舊密碼輸入錯誤');
        }
      }
    }

    const { code: _, currentPassword: __, ...dataToUpdate } = updateUserDto;
    if (dataToUpdate.password) {
      dataToUpdate.password = await bcrypt.hash(dataToUpdate.password, 10);
      // 密碼變更時，撤銷該用戶所有裝置的 Refresh Token
      await this.deleteUserRefreshTokens(id);
    }

    return this.prisma.client.user.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async remove(id: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`用戶不存在`);
    }

    // 軟刪除：更新 deletedAt，並修改 email 以避免佔用唯一鍵，同時清除第三方綁定以利重複使用
    await this.prisma.client.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        email: user.email ? `${user.email}_deleted_${Date.now()}` : null,
        googleId: null,
        discordId: null,
        telegramId: null,
        telegramChatId: null,
      },
    });

    // 軟刪除時，撤銷該用戶所有的 Refresh Token
    await this.deleteUserRefreshTokens(id);

    return { message: '用戶已刪除' };
  }

  async createRefreshToken(userId: string, token: string, expiresAt: Date, id?: string, ip?: string, userAgent?: string) {
    return this.prisma.client.refreshToken.create({
      data: {
        ...(id && { id }),
        userId,
        token,
        expiresAt,
        ip,
        userAgent,
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
