import { StaffRole } from '@prisma/client';
import { getRolePermissions, STAFF_PERMISSION_SET } from './permissions';

describe('staff permissions', () => {
  it('keeps security and jobs manage permissions owner-only by default', () => {
    expect(STAFF_PERMISSION_SET.has('security.manage')).toBe(true);
    expect(getRolePermissions(StaffRole.owner)).toContain('security.manage');
    expect(getRolePermissions(StaffRole.branch_manager)).not.toContain(
      'security.manage',
    );
    expect(getRolePermissions(StaffRole.cashier)).not.toContain(
      'system.jobs.read',
    );
  });
});

