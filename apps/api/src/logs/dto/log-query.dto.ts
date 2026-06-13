import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { LogLevel, LogType } from '../../common/logger/logger.service';

export class LogQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: '日誌等級',
    enum: LogLevel,
  })
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  @ApiPropertyOptional({
    description: '日誌類型',
    enum: LogType,
  })
  @IsOptional()
  @IsEnum(LogType)
  type?: LogType;

  @ApiPropertyOptional({
    description: '用戶 ID',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: '用戶帳號',
  })
  @IsOptional()
  @IsString()
  userAccount?: string;

  @ApiPropertyOptional({
    description: 'HTTP 狀態碼',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  statusCode?: number;

  @ApiPropertyOptional({
    description: 'HTTP 請求方法',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({
    description: '客戶端 IP',
  })
  @IsOptional()
  @IsString()
  clientIp?: string;

  @ApiPropertyOptional({
    description: '關鍵字搜尋（搜尋 message 欄位）',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: '開始時間',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: '結束時間',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
