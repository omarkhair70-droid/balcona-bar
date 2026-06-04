import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class BillActionDto {
  @IsOptional()
  @IsUUID()
  staffUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
