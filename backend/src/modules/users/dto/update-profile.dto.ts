import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Joe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+234' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  phoneCountryCode?: string;

  @ApiPropertyOptional({ example: '7012345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Nigeria' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @ApiPropertyOptional({ example: '10' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  houseNumber?: string;

  @ApiPropertyOptional({ example: 'Ajokele Ajayi Street' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  streetName?: string;

  @ApiPropertyOptional({ example: 'Abuja' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'FCT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;
}
