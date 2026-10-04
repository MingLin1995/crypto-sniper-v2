import { Controller, Get, Post, Delete, Body, Param, Query, Request, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BacktestService } from './backtest.service';
import { CreateBacktestDto } from './dto/backtest.dto';

@ApiTags('Backtest')
@ApiBearerAuth()
@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post()
  @ApiOperation({ summary: '發起回測任務 (BullMQ 後台排隊執行)' })
  @ApiBody({ type: CreateBacktestDto })
  @ApiResponse({ status: 201, description: '成功加入佇列，回傳任務狀態。' })
  @ApiResponse({ status: 400, description: '參數驗證失敗或回測時間長度超限。' })
  @ApiResponse({ status: 409, description: '已有執行中的任務 (防重複發起機制)。' })
  async create(@Request() req: any, @Body() dto: CreateBacktestDto) {
    return this.backtestService.createJob(req.user.sub, dto);
  }

  @Get('history')
  @ApiOperation({ summary: '獲取使用者歷史回測紀錄 (分頁)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '成功獲取歷史紀錄。' })
  async getHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    let pageNum = page ? parseInt(page, 10) : 1;
    let limitNum = limit ? parseInt(limit, 10) : 10;
    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if (isNaN(limitNum) || limitNum < 1) limitNum = 10;
    if (limitNum > 50) limitNum = 50;
    return this.backtestService.getHistory(req.user.sub, pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: '獲取單筆回測詳情與狀態' })
  @ApiResponse({ status: 200, description: '成功獲取回測狀態與結果。' })
  @ApiResponse({ status: 404, description: '找不到該回測任務。' })
  async getJob(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.backtestService.getJob(req.user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '刪除歷史回測紀錄' })
  @ApiResponse({ status: 200, description: '成功刪除回測紀錄。' })
  @ApiResponse({ status: 404, description: '找不到該回測任務。' })
  @ApiResponse({ status: 400, description: '任務執行中無法刪除。' })
  async deleteJob(@Request() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.backtestService.deleteJob(req.user.sub, id);
  }
}
