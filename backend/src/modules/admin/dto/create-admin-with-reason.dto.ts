import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAdminWithReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string | null;

  @IsIn(['SUPER_ADMIN', 'FINANCE_ADMIN', 'OPERATION_ADMIN', 'COMPLIANCE_ADMIN'])
  role!: 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'OPERATION_ADMIN' | 'COMPLIANCE_ADMIN';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
