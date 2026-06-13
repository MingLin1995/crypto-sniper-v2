import { Controller, Get, Query, Delete, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { LogQueryDto } from './dto/log-query.dto';
import { PaginatedLogResponseDto } from './dto/log-response.dto';
import { CleanupLogResponseDto } from './dto/cleanup-log-response.dto';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { ApiOkResponseGeneric } from '../common/decorators/api-ok-response-generic.decorator';

@ApiTags('Logs')
@ApiBearerAuth()
@Controller('logs')
@Roles(Role.ADMIN)
export class LogsController {
  constructor(private readonly logsService: LogsService) { }

  @Get()
  @ApiOperation({
    summary: '查詢系統日誌（ADMIN）',
    description: '支援多種篩選條件：等級、類型、用戶、狀態碼、時間範圍、關鍵字搜尋等',
  })
  @ApiOkResponseGeneric(PaginatedLogResponseDto)
  findAll(@Query() queryDto: LogQueryDto) {
    return this.logsService.findAll(queryDto);
  }

  @Delete('cleanup')
  @ApiOperation({
    summary: '清理舊日誌',
    description: '刪除 30 天前的舊日誌（預設），或透過 query 參數指定天數',
  })
  @ApiOkResponseGeneric(CleanupLogResponseDto)
  deleteOldLogs(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days, 10) : 30;
    if (isNaN(daysNumber) || daysNumber <= 0) {
      throw new BadRequestException('清理天數必須是正整數');
    }
    return this.logsService.deleteOldLogs(daysNumber);
  }
}
