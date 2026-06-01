import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseTableSessionDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  reason?: string;
}
