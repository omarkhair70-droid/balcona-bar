import { IsNotEmpty, IsString } from 'class-validator';

export class CompanyIdParamDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;
}

export class BranchIdParamDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;
}
