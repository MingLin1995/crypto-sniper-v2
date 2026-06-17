import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateWatchlistDto {
  @ApiProperty({ example: 'BTCUSDT', description: '交易對名稱' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{3,12}USDT$/)
  symbol!: string;
}
