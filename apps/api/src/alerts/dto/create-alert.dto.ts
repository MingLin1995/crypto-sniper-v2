import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsPositive, Matches, IsIn } from 'class-validator';

export class CreateAlertDto {
  @ApiProperty({ example: 'BTCUSDT', description: '交易對名稱' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{3,12}USDT$/)
  symbol!: string;

  @ApiProperty({ example: 'ABOVE', description: '觸發條件 (ABOVE 或 BELOW)', enum: ['ABOVE', 'BELOW'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['ABOVE', 'BELOW'])
  condition!: string;

  @ApiProperty({ example: 65000, description: '目標價格' })
  @IsNumber()
  @IsPositive()
  targetPrice!: number;
}
