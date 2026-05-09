import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const ADMIN_CREATE_UI_ROLES = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'OPERATION_ADMIN', 'COMPLIANCE_ADMIN'] as const;
export type AdminCreateUiRole = (typeof ADMIN_CREATE_UI_ROLES)[number];

export class CreateAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string | null;

  @IsIn([...ADMIN_CREATE_UI_ROLES])
  role!: AdminCreateUiRole;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
