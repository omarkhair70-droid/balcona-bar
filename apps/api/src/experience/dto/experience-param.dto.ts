import { IsNotEmpty, IsUUID } from 'class-validator';

export class CompanyIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;
}

export class BranchIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;
}

export class ExperienceProfileIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  experienceProfileId!: string;
}
