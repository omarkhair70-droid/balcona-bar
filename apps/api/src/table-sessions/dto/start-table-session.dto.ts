import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class StartTableSessionDto {
  @IsString()
  @IsNotEmpty()
  qrToken!: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  guestLabel?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  partySize?: number;
}
