import { IsNotEmpty, IsString } from 'class-validator';

export class BranchIdParamDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;
}
