import { Module } from '@nestjs/common';
import { IpBlacklistService } from './ip-blacklist.service';
import { BlacklistIpController } from './blacklist-ip.controller';

@Module({
  controllers: [BlacklistIpController],
  providers: [IpBlacklistService],
  exports: [IpBlacklistService],
})
export class IpBlacklistModule {}
