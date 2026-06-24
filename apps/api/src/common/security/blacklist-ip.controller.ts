import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { IpBlacklistService } from './ip-blacklist.service';
import { BlacklistIpDto } from './dto/blacklist-ip.dto';
import { Roles, Role } from '../decorators/roles.decorator';
import { PaginationDto } from '../dto/pagination.dto';

@ApiTags('Admin Security')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/security/blacklist-ip')
export class BlacklistIpController {
  constructor(private readonly ipBlacklistService: IpBlacklistService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '新增 IP 至黑名單（ADMIN）',
    description: '新增後會同步更新資料庫與 Redis 快速快取，後續該 IP 所有的請求將被攔截。',
  })
  async blacklistIp(@Body() body: BlacklistIpDto) {
    return this.ipBlacklistService.blacklistIp(body.ip, body.reason);
  }

  @Delete(':ip')
  @ApiOperation({
    summary: '自黑名單移除 IP（ADMIN）',
    description: '將 IP 從黑名單中移除（白名單化），使其能恢復正常存取 API。',
  })
  @ApiParam({ name: 'ip', description: '要移除封鎖的 IP 位址', example: '192.168.1.100' })
  async whitelistIp(@Param('ip') ip: string) {
    return this.ipBlacklistService.whitelistIp(ip);
  }

  @Get()
  @ApiOperation({
    summary: '查詢黑名單列表（ADMIN）',
    description: '分頁查詢目前系統封鎖的所有 IP 列表。',
  })
  async getBlacklistedIps(@Query() query: PaginationDto) {
    return this.ipBlacklistService.getBlacklistedIps(query);
  }
}
