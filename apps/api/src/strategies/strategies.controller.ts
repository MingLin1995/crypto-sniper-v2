import { Controller, Get, Post, Patch, Delete, Body, Param, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { StrategiesService } from './strategies.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { UpdateStrategyDto } from './dto/update-strategy.dto';

@ApiTags('Strategies')
@ApiBearerAuth()
@Controller('strategies')
export class StrategiesController {
  constructor(private readonly strategiesService: StrategiesService) {}

  @Post()
  @ApiOperation({ summary: '儲存新策略' })
  @ApiBody({ type: CreateStrategyDto })
  @ApiResponse({ status: 201, description: '成功儲存策略。' })
  @ApiResponse({ status: 409, description: '已存在同名的儲存策略。' })
  async create(@Request() req: any, @Body() dto: CreateStrategyDto) {
    return this.strategiesService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: '取得用戶所有儲存的策略' })
  @ApiResponse({ status: 200, description: '成功取得策略列表。' })
  async findAll(@Request() req: any) {
    return this.strategiesService.findAll(req.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新儲存的策略' })
  @ApiBody({ type: UpdateStrategyDto })
  @ApiResponse({ status: 200, description: '成功更新策略。' })
  @ApiResponse({ status: 404, description: '策略不存在或無存取權限。' })
  @ApiResponse({ status: 409, description: '已存在同名的儲存策略。' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateStrategyDto) {
    return this.strategiesService.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '刪除儲存的策略' })
  @ApiResponse({ status: 200, description: '成功刪除策略。' })
  @ApiResponse({ status: 404, description: '策略不存在或無存取權限。' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.strategiesService.remove(req.user.sub, id);
  }
}
