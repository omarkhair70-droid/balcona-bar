import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { STAFF_PERMISSIONS, StaffPermission } from '../permissions';

export class StaffCanQueryDto {
  @IsIn([...STAFF_PERMISSIONS])
  permission!: StaffPermission;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
