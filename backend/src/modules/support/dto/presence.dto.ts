import { IsBoolean } from 'class-validator';

export class SetSupportPresenceDto {
  @IsBoolean()
  isOnline!: boolean;
}

