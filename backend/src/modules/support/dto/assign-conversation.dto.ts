import { IsOptional, IsString } from 'class-validator';

export class AssignSupportConversationDto {
  /** Assign to this admin id; omit to assign to current admin. */
  @IsOptional()
  @IsString()
  adminId?: string;
}

