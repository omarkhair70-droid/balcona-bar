import { IsOptional, IsString, MaxLength } from "class-validator";

export class RejectCartProposalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
