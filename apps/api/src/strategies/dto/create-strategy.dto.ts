import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StrategyConfigDto } from '../../market/dto/screener.dto';

export class CreateStrategyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateNested()
  @Type(() => StrategyConfigDto)
  config!: StrategyConfigDto;
}
