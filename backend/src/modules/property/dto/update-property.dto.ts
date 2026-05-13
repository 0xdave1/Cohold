import { PartialType } from '@nestjs/mapped-types';
import { CreatePropertyDto } from './create-property.dto';

/** All fields optional for PATCH admin/properties/:id */
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
