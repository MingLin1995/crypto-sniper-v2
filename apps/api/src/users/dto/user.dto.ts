import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';
import { PaginationMetaDto } from '../../common/dto/paginated-response.dto';

export class UpdateUserDto {
  @ApiProperty({
    description: 'Email',
    example: 'user@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: '電話',
    example: '0912345678',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: 'LINE User ID',
    example: 'U4af49806ea6bd.....',
    required: false,
  })
  @IsString()
  @IsOptional()
  lineUserId?: string;

  @ApiProperty({
    description: '密碼',
    example: '000000',
    required: false,
    minLength: 6,
  })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;
}

export class UserResponseDto {
  @ApiProperty({ example: 'uuid-string' })
  id!: string;

  @ApiProperty({ example: 'user001' })
  account!: string;

  @ApiProperty({ example: 'USER' })
  role!: string;

  @ApiProperty({ example: 'user@example.com', required: false, nullable: true })
  email?: string;

  @ApiProperty({ example: '0912345678', required: false, nullable: true })
  phone?: string;

  @ApiProperty({ example: 'U4af49806ea6bd.....', required: false, nullable: true })
  lineUserId?: string;

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
