import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestBillDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
