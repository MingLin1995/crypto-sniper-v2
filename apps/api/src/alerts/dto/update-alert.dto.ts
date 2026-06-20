import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, Matches, IsIn, IsOptional } from 'class-validator';

export class UpdateAlertDto {
  @ApiProperty({ example: 'BTCUSDT', description: '交易對名稱', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z0-9]{3,12}USDT$/)
  symbol?: string;

  @ApiProperty({ example: 'ABOVE', description: '觸發條件 (ABOVE 或 BELOW)', enum: ['ABOVE', 'BELOW'], required: false })
  @IsString()
  @IsOptional()
  @IsIn(['ABOVE', 'BELOW'])
  condition?: string;

  @ApiProperty({ example: 65000, description: '目標價格', required: false })
  @IsNumber()
  @IsOptional()
  @IsPositive()
  targetPrice?: number;
}
