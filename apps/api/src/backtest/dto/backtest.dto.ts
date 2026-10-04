import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
  ArrayMaxSize,
  IsNotEmpty,
} from 'class-validator';
import { ScreenerTimeframeBlockDto, MAConditionDto } from '../../market/dto/screener.dto';

export class CreateBacktestDto {
  @IsOptional()
  @IsString()
  strategyId?: string;

  @IsOptional()
  @IsString()
  strategyName?: string;

  @IsArray()
  @ArrayMaxSize(10, { message: '每次回測最大標的數量限制為 10 個交易對 / Maximum 10 symbols per backtest' })
  @IsString({ each: true })
  symbols!: string[];

  @IsString()
  @IsNotEmpty()
  @IsIn(['5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M'])
  interval!: string;

  @IsInt()
  @Min(0)
  startTime!: number;

  @IsInt()
  @Min(0)
  endTime!: number;

  @IsInt()
  @Min(1)
  @Max(125)
  leverage!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.1)
  takerFeeRate?: number; // 預設 0.0004 (0.04%)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.1)
  makerFeeRate?: number; // 預設 0.0002 (0.02%)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  slippage?: number; // 預設 0.05 (即 0.05%)，最大 5 (即 5%)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  tpPercent?: number; // 預設固定停利 % (例如 15 代表 +15%)

  @IsOptional()
  @IsBoolean()
  useSignalExit?: boolean; // 訊號反向平倉 (預設 true，指標死叉即平倉)

  @IsOptional()
  @IsString()
  @IsIn(['AUTO_REVERSE', 'CUSTOM', 'NONE'])
  exitConditionMode?: 'AUTO_REVERSE' | 'CUSTOM' | 'NONE';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MAConditionDto)
  exitConditions?: MAConditionDto[];

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  slPercent?: number;


  @IsOptional()
  @IsNumber()
  @Min(100)
  initialBalance?: number; // 預設 10000

  @IsOptional()
  @IsNumber()
  @Min(-0.1)
  @Max(0.1)
  fundingRate?: number; // 預設 0.0001 (0.01%)

  @IsString()
  @IsIn(['FIXED_PERCENT', 'RISK_BASED'])
  positionSizingMode!: 'FIXED_PERCENT' | 'RISK_BASED';

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  fixedMarginPercent?: number; // 預設 10%

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  riskPercentPerTrade?: number; // 預設 1%

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxPositions?: number; // 預設 5

  @IsArray()
  @ArrayMaxSize(10) // 支援與篩選器一致的最多 10 個時框區塊
  @ValidateNested({ each: true })
  @Type(() => ScreenerTimeframeBlockDto)
  timeframes!: ScreenerTimeframeBlockDto[];
}
