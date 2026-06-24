import { Controller, Get, Post, Delete, Body, Param, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { WatchlistService } from './watchlist.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';

@ApiTags('Watchlist')
@ApiBearerAuth()
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Post()
  @ApiOperation({ summary: '新增追蹤標的' })
  @ApiBody({ type: CreateWatchlistDto })
  @ApiResponse({ status: 201, description: '成功新增追蹤標的。' })
  @ApiResponse({ status: 400, description: '不支援的合約標的名稱。' })
  @ApiResponse({ status: 409, description: '標的已在追蹤清單中。' })
  async create(@Request() req: any, @Body() dto: CreateWatchlistDto) {
    return this.watchlistService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: '取得用戶追蹤清單與即時快取價格' })
  @ApiResponse({ status: 200, description: '成功取得追蹤清單。' })
  async findAll(@Request() req: any) {
    return this.watchlistService.findAll(req.user.sub);
  }

  @Delete(':symbol')
  @ApiOperation({ summary: '移除追蹤標的' })
  @ApiResponse({ status: 200, description: '成功移除追蹤。' })
  @ApiResponse({ status: 404, description: '找不到該追蹤標的。' })
  async remove(@Request() req: any, @Param('symbol') symbol: string) {
    return this.watchlistService.remove(req.user.sub, symbol);
  }
}
