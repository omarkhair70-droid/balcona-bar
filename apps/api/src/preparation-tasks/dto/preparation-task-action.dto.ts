import { IsOptional, IsUUID } from 'class-validator';

export class PreparationTaskActionDto {
  @IsOptional()
  @IsUUID('4')
  staffUserId?: string;
}
