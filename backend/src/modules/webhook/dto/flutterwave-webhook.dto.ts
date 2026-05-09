import { IsObject, IsOptional, IsString } from 'class-validator';

export class FlutterwaveWebhookDto {
  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

