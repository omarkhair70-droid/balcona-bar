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

export class FloorIdParamDto {
  @IsString()
  @IsNotEmpty()
  floorId!: string;
}

export class TableIdParamDto {
  @IsString()
  @IsNotEmpty()
  tableId!: string;
}
