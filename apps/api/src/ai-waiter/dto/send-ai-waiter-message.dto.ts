import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class SendAiWaiterMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;
}
