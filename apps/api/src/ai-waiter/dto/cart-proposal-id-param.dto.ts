import { IsNotEmpty, IsUUID } from "class-validator";

export class CartProposalIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  proposalId!: string;
}
