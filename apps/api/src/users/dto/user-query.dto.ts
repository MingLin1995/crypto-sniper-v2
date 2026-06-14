import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/decorators/roles.decorator';

export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '搜尋暱稱（模糊搜尋，不區分大小寫）',
    example: '小明',
  })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({
    description: '搜尋 Email（模糊搜尋，不區分大小寫）',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: '角色篩選',
    enum: Role,
    example: Role.USER,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
