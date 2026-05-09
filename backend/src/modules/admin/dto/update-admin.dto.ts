import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ADMIN_CREATE_UI_ROLES, type AdminCreateUiRole } from './create-admin.dto';

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string | null;

  @IsOptional()
  @IsIn([...ADMIN_CREATE_UI_ROLES])
  role?: AdminCreateUiRole;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
