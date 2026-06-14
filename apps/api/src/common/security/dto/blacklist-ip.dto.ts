import { ApiProperty } from '@nestjs/swagger';
import { IsIP, IsOptional, IsString } from 'class-validator';

export class BlacklistIpDto {
  @ApiProperty({
    description: '要封鎖的 IP 位址 (支援 IPv4 與 IPv6)',
    example: '192.168.1.100',
  })
  @IsIP(undefined, { message: '請輸入有效的 IP 位址' })
  ip!: string;

  @ApiProperty({
    description: '封鎖原因',
    example: '惡意高頻刷 API',
    required: false,
  })
  @IsString({ message: '原因必須是字串' })
  @IsOptional()
  reason?: string;
}
