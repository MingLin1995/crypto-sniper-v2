import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class TelegramWidgetLoginDto {
  @ApiProperty({
    description: 'Telegram 用戶唯一 ID',
    example: 12345678,
  })
  @IsNumber()
  @IsNotEmpty()
  id!: number;

  @ApiProperty({
    description: '名字',
    example: 'Ming',
  })
  @IsString()
  @IsNotEmpty()
  first_name!: string;

  @ApiProperty({
    description: '姓氏',
    example: 'Lin',
    required: false,
  })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiProperty({
    description: 'Telegram 使用者名稱',
    example: 'ming_lin',
    required: false,
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: '頭像 URL',
    example: 'https://t.me/i/userpic/320/ming.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  photo_url?: string;

  @ApiProperty({
    description: '驗證產生的時間戳記',
    example: 1718337600,
  })
  @IsNumber()
  @IsNotEmpty()
  auth_date!: number;

  @ApiProperty({
    description: 'Telegram 計算之 SHA-256 雜湊驗證簽章',
    example: 'c6b8fa12...',
  })
  @IsString()
  @IsNotEmpty()
  hash!: string;
}
