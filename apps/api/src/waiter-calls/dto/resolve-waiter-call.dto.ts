import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ResolveWaiterCallDto {
  @IsOptional()
  @IsUUID()
  staffUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}
