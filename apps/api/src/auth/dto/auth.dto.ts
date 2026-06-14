import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Email 電子信箱 (登入帳號)',
    example: 'user@example.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: '密碼',
    example: '000000a1',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/, {
    message: '密碼必須至少包含一個英文字母和一個數字，且長度至少 8 碼',
  })
  password!: string;

  @ApiProperty({
    description: '使用者暱稱',
    example: '小明',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @ApiProperty({
    description: 'Email 驗證碼 (6位數字)',
    example: '123456',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Email 電子信箱',
    example: 'user@example.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: '密碼',
    example: '000000a1',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;

  @ApiProperty({
    description: '用戶資訊',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'uuid-string' },
      email: { type: 'string', example: 'user@example.com', nullable: true },
      nickname: { type: 'string', example: '小明' },
      role: { type: 'string', example: 'USER' },
    },
  })
  user!: {
    id: string;
    email: string | null;
    nickname: string;
    role: string;
  };
}

export class LogoutResponseDto {
  @ApiProperty({
    description: '訊息',
    example: 'Logged out successfully',
  })
  message!: string;
}
