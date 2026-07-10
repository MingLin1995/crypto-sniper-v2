import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested, ArrayMaxSize } from 'class-validator';

export class MAConditionDto {
  @IsOptional()
  @IsString()
  @IsIn(['SMA', 'EMA', 'RSI', 'MACD'])
  type?: 'SMA' | 'EMA' | 'RSI' | 'MACD';

  @IsOptional()
  @IsInt()
  @Min(1)
  period?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  macdFast?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  macdSlow?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  macdSignal?: number;

  @IsOptional()
  @IsString()
  @IsIn(['macd', 'signal', 'hist'])
  macdProperty?: 'macd' | 'signal' | 'hist';

  @IsString()
  @IsIn(['gt', 'lt'])
  operator!: 'gt' | 'lt';

  @IsOptional()
  @IsString()
  @IsIn(['indicator', 'value'])
  compareType?: 'indicator' | 'value';

  @IsOptional()
  @IsString()
  @IsIn(['SMA', 'EMA', 'RSI', 'MACD'])
  compareIndicatorType?: 'SMA' | 'EMA' | 'RSI' | 'MACD';

  @IsOptional()
  @IsInt()
  @Min(1)
  comparePeriod?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  compareMacdFast?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  compareMacdSlow?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  compareMacdSignal?: number;

  @IsOptional()
  @IsString()
  @IsIn(['macd', 'signal', 'hist'])
  compareMacdProperty?: 'macd' | 'signal' | 'hist';

  @IsOptional()
  @Type(() => Number)
  compareValue?: number;

  // --- Old fields for backward compatibility ---
  @IsOptional()
  @IsString()
  @IsIn(['SMA', 'EMA'])
  ma1Type?: 'SMA' | 'EMA';

  @IsOptional()
  @IsInt()
  @Min(1)
  ma1Period?: number;

  @IsOptional()
  @IsString()
  @IsIn(['SMA', 'EMA'])
  ma2Type?: 'SMA' | 'EMA';

  @IsOptional()
  @IsInt()
  @Min(1)
  ma2Period?: number;
}

export class ScreenerTimeframeBlockDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M'])
  interval!: string;

  @IsArray()
  @ArrayMaxSize(10) // Limit conditions per timeframe (prevent computational abuse)
  @ValidateNested({ each: true })
  @Type(() => MAConditionDto)
  conditions!: MAConditionDto[];
}

export class ScreenerRequestDto {
  @IsArray()
  @ArrayMaxSize(10) // Limit timeframe blocks (prevent computational abuse)
  @ValidateNested({ each: true })
  @Type(() => ScreenerTimeframeBlockDto)
  timeframes!: ScreenerTimeframeBlockDto[];
}

export class StrategyConfigDto extends ScreenerRequestDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @ArrayMaxSize(50) // Limit custom categories size
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];
}
