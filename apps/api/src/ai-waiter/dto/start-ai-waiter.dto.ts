import { IsOptional, IsString, MaxLength } from "class-validator";

export class StartAiWaiterDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;
}
