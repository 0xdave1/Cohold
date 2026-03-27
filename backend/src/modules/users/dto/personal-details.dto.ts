import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PersonalDetailsDto {
  @ApiProperty({ example: 'Joe' })
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: '+234' })
  @IsString()
  @MinLength(1, { message: 'Country code is required' })
  @MaxLength(10)
  phoneCountryCode!: string;

  @ApiProperty({ example: '7012345678' })
  @IsString()
  @MinLength(8, { message: 'Enter a valid phone number' })
  @MaxLength(20)
  phoneNumber!: string;

  @ApiProperty({ example: 'Nigeria' })
  @IsString()
  @MinLength(1, { message: 'Nationality is required' })
  @MaxLength(100)
  nationality!: string;
}
