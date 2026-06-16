import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested, ArrayMaxSize } from 'class-validator';

export class MAConditionDto {
  @IsString()
  @IsIn(['SMA', 'EMA'])
  ma1Type!: 'SMA' | 'EMA';

  @IsInt()
  @Min(1)
  ma1Period!: number;

  @IsString()
  @IsIn(['gt', 'lt'])
  operator!: 'gt' | 'lt';

  @IsString()
  @IsIn(['SMA', 'EMA'])
  ma2Type!: 'SMA' | 'EMA';

  @IsInt()
  @Min(1)
  ma2Period!: number;
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
