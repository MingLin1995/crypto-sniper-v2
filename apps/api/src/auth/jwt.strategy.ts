import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, RequestUser } from './interfaces/auth.interface';

import { JWT_CONFIG } from '../common/config/jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => {
          return req?.cookies?.access_token || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || JWT_CONFIG.SECRET_FALLBACK,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tokenId: payload.tokenId,
    };
  }
}
