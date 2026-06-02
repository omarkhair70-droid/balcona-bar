import { SetMetadata } from '@nestjs/common';
import { StaffPermission } from './permissions';

export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

export interface RequiredPermissionMetadata {
  permission: StaffPermission;
  companyIdParam?: string;
  branchIdParam?: string;
}

export function RequiredPermission(
  permission: StaffPermission,
  options: Omit<RequiredPermissionMetadata, 'permission'> = {},
) {
  return SetMetadata(REQUIRED_PERMISSION_KEY, {
    permission,
    ...options,
  } satisfies RequiredPermissionMetadata);
}
