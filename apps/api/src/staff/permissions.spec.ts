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

  it('reserves owner analytics for owner and branch manager roles', () => {
    const ownerAnalyticsPermission = 'owner_analytics.read';

    expect(STAFF_PERMISSION_SET.has(ownerAnalyticsPermission)).toBe(true);
    expect(getRolePermissions(StaffRole.owner)).toContain(
      ownerAnalyticsPermission,
    );
    expect(getRolePermissions(StaffRole.branch_manager)).toContain(
      ownerAnalyticsPermission,
    );

    for (const role of [
      StaffRole.cashier,
      StaffRole.waiter,
      StaffRole.kitchen,
      StaffRole.barista,
      StaffRole.menu_admin,
    ]) {
      expect(getRolePermissions(role)).not.toContain(ownerAnalyticsPermission);
    }
  });

  it('keeps cashier operations available without owner analytics access', () => {
    const cashierPermissions = getRolePermissions(StaffRole.cashier);

    expect(cashierPermissions).toContain('analytics.read');
    expect(cashierPermissions).toContain('orders.cashier_review');
    expect(cashierPermissions).toContain('bills.present');
    expect(cashierPermissions).toContain('bills.pay');
    expect(cashierPermissions).not.toContain('owner_analytics.read');
  });
});

