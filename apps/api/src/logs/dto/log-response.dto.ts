import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/paginated-response.dto';

export class LogResponseDto {
  @ApiProperty({ example: 'uuid-123' })
  id!: string;

  @ApiProperty({ example: 'ERROR' })
  level!: string;

  @ApiProperty({ example: 'REQUEST' })
  type!: string;

  @ApiProperty({ example: '[POST] /auth/login - 帳號或密碼錯誤' })
  message!: string;

  @ApiPropertyOptional({ example: 'UnauthorizedException' })
  errorType?: string;

  @ApiPropertyOptional({ example: 'Error: Unauthorized\n    at AuthService...' })
  errorStack?: string;

  @ApiPropertyOptional({ example: 'POST' })
  method?: string;

  @ApiPropertyOptional({ example: '/auth/login' })
  url?: string;

  @ApiPropertyOptional({ example: 401 })
  statusCode?: number;

  @ApiPropertyOptional({ example: 45 })
  duration?: number;

  @ApiPropertyOptional({ example: '{"account":"test","password":"***"}' })
  requestBody?: string;

  @ApiPropertyOptional({ example: '{}' })
  requestParams?: string;

  @ApiPropertyOptional({ example: '{"page":"1"}' })
  requestQuery?: string;

  @ApiPropertyOptional({ example: '192.168.1.100' })
  clientIp?: string;

  @ApiPropertyOptional({ example: 'Mozilla/5.0...' })
  userAgent?: string;

  @ApiPropertyOptional({ example: 'uuid-456' })
  userId?: string;

  @ApiPropertyOptional({ example: 'admin001' })
  userAccount?: string;

  @ApiPropertyOptional({ example: { action: 'LOGIN' } })
  metadata?: any;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedLogResponseDto {
  @ApiProperty({ type: [LogResponseDto], description: '日誌列表' })
  data!: LogResponseDto[];

  @ApiProperty({ type: PaginationMetaDto, description: '分頁元數據' })
  meta!: PaginationMetaDto;
}
