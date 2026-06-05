import { IsNotEmpty, IsString } from "class-validator";

export class SaasCompanyIdParamDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;
}

export class SaasBranchIdParamDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;
}
