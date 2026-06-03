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

export class BranchFloorParamDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  floorId!: string;
}

export class BranchTableParamDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  tableId!: string;
}
