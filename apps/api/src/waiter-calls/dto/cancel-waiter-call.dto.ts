import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelWaiterCallDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
