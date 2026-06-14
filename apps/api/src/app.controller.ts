import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('API Check')
@Controller()
export class AppController {
  private readonly appVersion: string;

  constructor(private readonly configService: ConfigService) {
    this.appVersion = this.configService.get<string>('APP_VERSION') || '1.0.0';
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'API 連線測試' })
  getHealth() {
    return {
      status: 'ok',
      message: 'API 連線正常',
      timestamp: new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      version: this.appVersion,
    };
  }
}
