import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StrategyConfigDto } from '../../market/dto/screener.dto';

export class UpdateStrategyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @ValidateNested()
  @Type(() => StrategyConfigDto)
  @IsOptional()
  config?: StrategyConfigDto;
}
