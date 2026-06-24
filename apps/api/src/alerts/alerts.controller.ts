import { Controller, Get, Post, Delete, Patch, Body, Param, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: '新增價格到價通知' })
  @ApiBody({ type: CreateAlertDto })
  @ApiResponse({ status: 201, description: '成功新增告警。' })
  @ApiResponse({ status: 400, description: '不支援的合約標的名稱。' })
  async create(@Request() req: any, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: '取得當前使用者所有告警設定' })
  @ApiResponse({ status: 200, description: '成功取得告警清單。' })
  async findAll(@Request() req: any) {
    return this.alertsService.findAll(req.user.sub);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: '啟用或關閉指定價格告警' })
  @ApiResponse({ status: 200, description: '成功更新狀態。' })
  @ApiResponse({ status: 404, description: '找不到該告警設定。' })
  async toggle(@Request() req: any, @Param('id') id: string) {
    return this.alertsService.toggle(req.user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '編輯價格到價通知' })
  @ApiBody({ type: UpdateAlertDto })
  @ApiResponse({ status: 200, description: '成功編輯告警。' })
  @ApiResponse({ status: 400, description: '不支援的合約標的名稱。' })
  @ApiResponse({ status: 404, description: '找不到該告警設定。' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAlertDto) {
    return this.alertsService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '刪除價格告警設定' })
  @ApiResponse({ status: 200, description: '成功刪除告警。' })
  @ApiResponse({ status: 404, description: '找不到該告警設定。' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.alertsService.remove(req.user.sub, id);
  }
}
