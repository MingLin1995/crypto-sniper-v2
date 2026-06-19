import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, MinLength, Matches } from 'class-validator';
import { PaginationMetaDto } from '../../common/dto/paginated-response.dto';
import { PASSWORD_REGEX, PASSWORD_VALIDATION_MESSAGE } from '../../common/constants/regex.constants';

export class UpdateUserDto {
  @ApiProperty({
    description: 'Email 電子信箱',
    example: 'user@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: '使用者暱稱',
    example: '新暱稱',
    required: false,
  })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiProperty({
    description: '密碼',
    example: '000000a1',
    required: false,
    minLength: 8,
  })
  @IsString()
  @IsOptional()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, {
    message: PASSWORD_VALIDATION_MESSAGE,
  })
  password?: string;

  @ApiProperty({
    description: 'Email 驗證碼 (當變更或綁定信箱時必填)',
    example: '123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({
    description: '當前舊密碼 (若已設定密碼則變更密碼時必填)',
    example: 'oldPassword123',
    required: false,
  })
  @IsString()
  @IsOptional()
  currentPassword?: string;

  @ApiProperty({
    description: 'Discord Webhook 網址 (用於發送到價通知)',
    example: 'https://discord.com/api/webhooks/...',
    required: false,
  })
  @IsString()
  @IsOptional()
  discordWebhook?: string;
}

export class UserResponseDto {
  @ApiProperty({ example: 'uuid-string' })
  id!: string;

  @ApiProperty({ example: '小明' })
  nickname!: string;

  @ApiProperty({ example: 'USER' })
  role!: string;

  @ApiProperty({ example: 'user@example.com', required: false, nullable: true })
  email?: string | null;

  @ApiProperty({ example: 'google-id', required: false, nullable: true })
  googleId?: string | null;

  @ApiProperty({ example: 'telegram-id', required: false, nullable: true })
  telegramId?: string | null;

  @ApiProperty({ example: 'discord-id', required: false, nullable: true })
  discordId?: string | null;

  @ApiProperty({ example: 'telegram-chat-id', required: false, nullable: true })
  telegramChatId?: string | null;

  @ApiProperty({ example: 'discord-webhook-url', required: false, nullable: true })
  discordWebhook?: string | null;

  @ApiProperty({ example: true, description: '是否已設定密碼' })
  hasPassword!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedUserResponseDto {
  @ApiProperty({ type: [UserResponseDto], description: '用戶列表' })
  data!: UserResponseDto[];

  @ApiProperty({ type: PaginationMetaDto, description: '分頁元數據' })
  meta!: PaginationMetaDto;
}
