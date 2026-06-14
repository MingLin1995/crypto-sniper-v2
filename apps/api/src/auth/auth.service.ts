import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RedisService } from '../common/redis/redis.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import ms = require('ms');
import { JWT_CONFIG } from '../common/config/jwt.config';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthenticatedUser, LoginResponse, RequestUser } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<AuthenticatedUser> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user || !user.password) {
      throw new UnauthorizedException('電子信箱或密碼錯誤');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('電子信箱或密碼錯誤');
    }

    return this.usersService.findOne(user.id);
  }

  async login(user: AuthenticatedUser): Promise<LoginResponse> {
    const tokens = await this.generateTokens(user.id, user.email || null, user.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email || null,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    const redis = this.redisService.getClient();
    const cachedCode = await redis.get(`email_verify:${registerDto.email}`);

    if (!cachedCode || cachedCode !== registerDto.code) {
      throw new BadRequestException('驗證碼無效或已過期');
    }

    // 驗證成功，清除快取
    await redis.del(`email_verify:${registerDto.email}`);

    const user = await this.usersService.create({
      email: registerDto.email,
      password: registerDto.password,
      nickname: registerDto.nickname,
    });

    return this.login(user);
  }

  async logout(user: RequestUser) {
    if (user.tokenId) {
      await this.usersService.deleteRefreshToken(user.tokenId);
    } else {
      await this.usersService.deleteUserRefreshTokens(user.sub);
    }
  }

  async refreshTokens(userId: string, rt: string): Promise<LoginResponse> {
    try {
      const decoded = (await this.jwtService.verifyAsync(rt, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || JWT_CONFIG.REFRESH_SECRET_FALLBACK,
      })) as any;
      const tokenId = decoded?.tokenId;

      if (!tokenId) throw new ForbiddenException('Invalid Token Structure');

      const tokenRecord = await this.usersService.findRefreshTokenById(tokenId);
      if (!tokenRecord) throw new ForbiddenException('Access Denied');

      await this.usersService.findOne(userId);

      const rtMatches = await bcrypt.compare(rt, tokenRecord.token);
      if (!rtMatches) throw new ForbiddenException('Access Denied');

      await this.usersService.deleteRefreshToken(tokenId);

      const tokens = await this.generateTokens(userId, decoded.email || null, decoded.role);

      const user = await this.usersService.findOne(userId);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: userId,
          email: decoded.email || null,
          nickname: user.nickname,
          role: decoded.role,
        },
      };
    } catch (error) {
      throw new ForbiddenException('Access Denied');
    }
  }

  async generateTokens(userId: string, email: string | null, role: string) {
    const tokenId = crypto.randomUUID();

    const payload = {
      sub: userId,
      email,
      role,
      tokenId,
    };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET') || JWT_CONFIG.SECRET_FALLBACK,
        expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '30m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || JWT_CONFIG.REFRESH_SECRET_FALLBACK,
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
