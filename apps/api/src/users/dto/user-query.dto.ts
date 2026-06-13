import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/decorators/roles.decorator';

export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '搜尋帳號（模糊搜尋，不區分大小寫）',
    example: 'user001',
  })
  @IsOptional()
  @IsString()
  account?: string;

  @ApiPropertyOptional({
    description: '搜尋 Email（模糊搜尋，不區分大小寫）',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: '搜尋電話（模糊搜尋）',
    example: '0912345678',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: '角色篩選',
    enum: Role,
    example: Role.USER,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
