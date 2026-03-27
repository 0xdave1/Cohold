import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResidentialDetailsDto {
  @ApiProperty({ example: '10' })
  @IsString()
  @MinLength(1, { message: 'House number is required' })
  @MaxLength(20)
  houseNumber!: string;

  @ApiProperty({ example: 'Ajokele Ajayi Street' })
  @IsString()
  @MinLength(1, { message: 'Street name is required' })
  @MaxLength(200)
  streetName!: string;

  @ApiProperty({ example: 'Abuja' })
  @IsString()
  @MinLength(1, { message: 'City/Town is required' })
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'FCT' })
  @IsString()
  @MinLength(1, { message: 'State is required' })
  @MaxLength(100)
  state!: string;
}
