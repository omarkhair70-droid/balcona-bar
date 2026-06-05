import { StaffRole } from "@prisma/client";
import { getRolePermissions, STAFF_PERMISSION_SET } from "./permissions";

describe("staff permissions", () => {
  it("keeps security and jobs manage permissions owner-only by default", () => {
    expect(STAFF_PERMISSION_SET.has("security.manage")).toBe(true);
    expect(getRolePermissions(StaffRole.owner)).toContain("security.manage");
    expect(getRolePermissions(StaffRole.branch_manager)).not.toContain(
      "security.manage",
    );
    expect(getRolePermissions(StaffRole.cashier)).not.toContain(
      "system.jobs.read",
    );
  });

  it("reserves owner analytics for owner and branch manager roles", () => {
    const ownerAnalyticsPermission = "owner_analytics.read";

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

  it("keeps cashier operations available without owner analytics access", () => {
    const cashierPermissions = getRolePermissions(StaffRole.cashier);

    expect(cashierPermissions).toContain("analytics.read");
    expect(cashierPermissions).toContain("orders.cashier_review");
    expect(cashierPermissions).toContain("bills.present");
    expect(cashierPermissions).toContain("bills.pay");
    expect(cashierPermissions).not.toContain("owner_analytics.read");
  });

  it("exposes online payment visibility without broad mock/provider management", () => {
    expect(STAFF_PERMISSION_SET.has("online_payments.read")).toBe(true);
    expect(STAFF_PERMISSION_SET.has("online_payments.manage")).toBe(true);

    for (const role of [StaffRole.owner, StaffRole.branch_manager]) {
      expect(getRolePermissions(role)).toContain("online_payments.read");
      expect(getRolePermissions(role)).toContain("online_payments.manage");
    }

    for (const role of [StaffRole.cashier, StaffRole.waiter]) {
      expect(getRolePermissions(role)).toContain("online_payments.read");
      expect(getRolePermissions(role)).not.toContain("online_payments.manage");
    }

    for (const role of [StaffRole.kitchen, StaffRole.barista]) {
      expect(getRolePermissions(role)).not.toContain("online_payments.read");
      expect(getRolePermissions(role)).not.toContain("online_payments.manage");
    }
  });

  it("reserves tenant onboarding for owner and branch manager roles", () => {
    for (const permission of [
      "tenant_onboarding.read",
      "tenant_onboarding.manage",
    ] as const) {
      expect(STAFF_PERMISSION_SET.has(permission)).toBe(true);
      expect(getRolePermissions(StaffRole.owner)).toContain(permission);
      expect(getRolePermissions(StaffRole.branch_manager)).toContain(
        permission,
      );

      for (const role of [
        StaffRole.cashier,
        StaffRole.waiter,
        StaffRole.kitchen,
        StaffRole.barista,
        StaffRole.menu_admin,
      ]) {
        expect(getRolePermissions(role)).not.toContain(permission);
      }
    }

    expect(getRolePermissions(StaffRole.branch_manager)).toContain(
      "staff.manage",
    );
    expect(getRolePermissions(StaffRole.cashier)).not.toContain("staff.manage");
  });

  it("allows broad inventory visibility but reserves stock management", () => {
    expect(STAFF_PERMISSION_SET.has("inventory.read")).toBe(true);
    expect(STAFF_PERMISSION_SET.has("inventory.manage")).toBe(true);

    for (const role of [
      StaffRole.owner,
      StaffRole.branch_manager,
      StaffRole.menu_admin,
    ]) {
      expect(getRolePermissions(role)).toContain("inventory.read");
      expect(getRolePermissions(role)).toContain("inventory.manage");
    }

    for (const role of [
      StaffRole.cashier,
      StaffRole.waiter,
      StaffRole.kitchen,
      StaffRole.barista,
    ]) {
      expect(getRolePermissions(role)).toContain("inventory.read");
      expect(getRolePermissions(role)).not.toContain("inventory.manage");
    }
  });
});
