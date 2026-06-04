import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkPrintJobFailedDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string | null;
}
