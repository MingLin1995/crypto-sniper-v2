import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnsubscribeWebPushDto {
  @ApiProperty({
    description: 'Web Push Endpoint URL',
    example: 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB...',
  })
  @IsString()
  @IsNotEmpty()
  endpoint!: string;
}
