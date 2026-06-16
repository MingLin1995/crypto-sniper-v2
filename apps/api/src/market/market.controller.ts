import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ScreenerService } from './screener.service';
import { ScreenerRequestDto } from './dto/screener.dto';

@ApiTags('Market')
@ApiBearerAuth()
@Controller('market')
export class MarketController {
  constructor(private readonly screenerService: ScreenerService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('screener')
  @HttpCode(200)
  @ApiOperation({ summary: '多時框均線指標篩選' })
  @ApiBody({ type: ScreenerRequestDto })
  @ApiResponse({ status: 200, description: '成功返回符合條件的標的列表。' })
  @ApiResponse({ status: 503, description: '行情資料預熱中，請稍後再試。' })
  async screen(@Body() dto: ScreenerRequestDto) {
    return this.screenerService.screen(dto);
  }
}
