import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import ms = require('ms');
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthenticatedUser, LoginResponse, RequestUser } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async validateUser(loginDto: LoginDto): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByAccount(loginDto.account);

    if (!user || !user.password) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('帳號或密碼錯誤');
    }

    return this.usersService.findOne(user.id);
  }

  async login(user: AuthenticatedUser): Promise<LoginResponse> {
    const tokens = await this.generateTokens(user.id, user.account, user.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        account: user.account,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    const user = await this.usersService.create(registerDto);
    return this.login(user);
  }

  async logout(user: RequestUser) {
    if (user.tokenId) {
      await this.usersService.deleteRefreshToken(user.tokenId);
    } else {
      // 如果找不到 tokenId，則刪除所有 token
      await this.usersService.deleteUserRefreshTokens(user.sub);
    }
  }

  async refreshTokens(userId: string, rt: string): Promise<LoginResponse> {
    try {
      const decoded = await this.jwtService.verifyAsync(rt, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key',
      }) as any;
      const tokenId = decoded?.tokenId;

      if (!tokenId) throw new ForbiddenException('Invalid Token Structure');

      const tokenRecord = await this.usersService.findRefreshTokenById(tokenId);
      if (!tokenRecord) throw new ForbiddenException('Access Denied');

      // 檢查使用者是否仍然存在且未被軟刪除
      await this.usersService.findOne(userId);

      const rtMatches = await bcrypt.compare(rt, tokenRecord.token);
      if (!rtMatches) throw new ForbiddenException('Access Denied');

      // 刪除舊的，建立新的
      await this.usersService.deleteRefreshToken(tokenId);

      const tokens = await this.generateTokens(userId, decoded.account, decoded.role);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: userId,
          account: decoded.account,
          role: decoded.role,
        },
      };
    } catch (error) {
      throw new ForbiddenException('Access Denied');
    }
  }

  async generateTokens(userId: string, account: string, role: string) {
    const tokenId = crypto.randomUUID();

    const payload = {
      sub: userId,
      account,
      role,
      tokenId,
    };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '30m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'your-refresh-secret-key',
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d') as any,
      }),
    ]);

    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const parsedMs = ms(refreshExpiresIn as any);
    const expiresMs = typeof parsedMs === 'number' ? parsedMs : 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresMs);

    const hash = await bcrypt.hash(rt, 10);
    await this.usersService.createRefreshToken(userId, hash, expiresAt, tokenId);

    return {
      accessToken: at,
      refreshToken: rt,
    };
  }
}
