import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribeWebPushDto {
  @ApiProperty({
    description: 'Web Push Endpoint URL',
    example: 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB...',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^https:\/\/(?:[a-zA-Z0-9-]+\.)*(?:push\.services\.mozilla\.com|googleapis\.com|push\.apple\.com|notify\.windows\.com)\//, {
    message: 'Web Push endpoint 必須是合法的瀏覽器推播伺服器網址 (Mozilla, Google, Apple, Microsoft)',
  })
  endpoint!: string;

  @ApiProperty({
    description: 'Web Push Client Public Key (p256dh)',
    example: 'BIPUL123...',
  })
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @ApiProperty({
    description: 'Web Push Auth Secret',
    example: 'auth123...',
  })
  @IsString()
  @IsNotEmpty()
  auth!: string;
}
