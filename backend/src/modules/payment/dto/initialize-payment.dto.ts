import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InitializePaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  amount!: number;
}
