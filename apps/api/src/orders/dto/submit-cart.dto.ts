import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitCartDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNote?: string | null;
}
