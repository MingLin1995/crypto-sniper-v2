import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribeWebPushDto {
  @ApiProperty({
    description: 'Web Push Endpoint URL',
    example: 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB...',
  })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty({
    description: 'Web Push Client Public Key (p256dh)',
    example: 'BIPUL123...',
  })
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty({
    description: 'Web Push Auth Secret',
    example: 'auth123...',
  })
  @IsString()
  @IsNotEmpty()
  auth: string;
}
