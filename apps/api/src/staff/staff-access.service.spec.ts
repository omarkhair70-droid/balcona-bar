import { StaffRole, StaffStatus } from '@prisma/client';
import { StaffAccessService } from './staff-access.service';

const now = new Date('2026-01-01T00:00:00.000Z');

const company = {
  id: 'company-1',
  name: 'Balkona',
  slug: 'balkona',
  status: 'active',
};

const branchOne = {
  id: 'branch-1',
  companyId: company.id,
  name: 'Main',
  slug: 'main',
  status: 'active',
  company,
};

const branchTwo = {
  id: 'branch-2',
  companyId: company.id,
  name: 'Garden',
  slug: 'garden',
  status: 'active',
  company,
};

function buildMembership(input: {
  branch?: typeof branchOne | null;
  role?: StaffRole;
  status?: StaffStatus;
}) {
  return {
    id: `${input.branch?.id ?? 'company'}-${input.role ?? StaffRole.cashier}`,
    staffUserId: 'staff-1',
    companyId: company.id,
    branchId: input.branch?.id ?? null,
    role: input.role ?? StaffRole.cashier,
    status: input.status ?? StaffStatus.active,
    createdAt: now,
    updatedAt: now,
    company,
    branch: input.branch ?? null,
  };
}

function buildStaffUser(input: {
  status?: StaffStatus;
  memberships: ReturnType<typeof buildMembership>[];
}) {
  return {
    id: 'staff-1',
    email: 'staff@balkona.test',
    name: 'Staff',
    status: input.status ?? StaffStatus.active,
    createdAt: now,
    updatedAt: now,
    memberships: input.memberships,
  };
}

function buildService(staffUser: ReturnType<typeof buildStaffUser>) {
  const prisma = {
    staffUser: {
      findUnique: jest.fn().mockResolvedValue(staffUser),
    },
    branch: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === branchTwo.id ? branchTwo : branchOne),
      ),
      findMany: jest.fn().mockResolvedValue([branchOne, branchTwo]),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue(company),
    },
  };

  return {
    service: new StaffAccessService(prisma as never),
    prisma,
  };
}

describe('StaffAccessService', () => {
  it('allows company-level memberships across branches in the same company', async () => {
    const { service } = buildService(
      buildStaffUser({
        memberships: [buildMembership({ branch: null, role: StaffRole.cashier })],
      }),
    );

    const result = await service.can('staff-1', 'orders.read', {
      branchId: branchTwo.id,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('permission_granted_by_company_membership');
  });

  it('denies branch-level memberships in another branch', async () => {
    const { service } = buildService(
      buildStaffUser({
        memberships: [
          buildMembership({ branch: branchOne, role: StaffRole.cashier }),
        ],
      }),
    );

    const result = await service.can('staff-1', 'orders.read', {
      branchId: branchTwo.id,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_active_membership_for_scope');
  });

  it('denies inactive staff users even when memberships exist', async () => {
    const { service } = buildService(
      buildStaffUser({
        status: StaffStatus.inactive,
        memberships: [buildMembership({ branch: null, role: StaffRole.owner })],
      }),
    );

    const result = await service.can('staff-1', 'settings.manage', {
      branchId: branchOne.id,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('staff_user_inactive');
  });

  it('allows branch-level menu admins to manage branch availability only', async () => {
    const { service } = buildService(
      buildStaffUser({
        memberships: [
          buildMembership({ branch: branchOne, role: StaffRole.menu_admin }),
        ],
      }),
    );

    await expect(
      service.can('staff-1', 'menu.read', {
        branchId: branchOne.id,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      reason: 'permission_granted_by_branch_membership',
    });

    await expect(
      service.can('staff-1', 'menu.manage_branch_overrides', {
        branchId: branchOne.id,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      reason: 'permission_granted_by_branch_membership',
    });

    for (const permission of [
      'menu.manage_categories',
      'menu.manage_items',
      'menu.manage_modifiers',
    ] as const) {
      await expect(
        service.can('staff-1', permission, {
          companyId: company.id,
        }),
      ).resolves.toMatchObject({
        allowed: false,
        reason: 'no_active_membership_for_scope',
      });
    }
  });

  it('allows company-level owner, menu admin, and branch manager roles to manage the full company menu', async () => {
    for (const role of [
      StaffRole.owner,
      StaffRole.menu_admin,
      StaffRole.branch_manager,
    ]) {
      const { service } = buildService(
        buildStaffUser({
          memberships: [buildMembership({ branch: null, role })],
        }),
      );

      for (const permission of [
        'menu.manage_categories',
        'menu.manage_items',
        'menu.manage_modifiers',
      ] as const) {
        await expect(
          service.can('staff-1', permission, {
            companyId: company.id,
          }),
        ).resolves.toMatchObject({
          allowed: true,
          reason: 'permission_granted_by_company_membership',
        });
      }
    }
  });

  it('allows owner analytics only for owner and branch manager branch access', async () => {
    for (const role of [StaffRole.owner, StaffRole.branch_manager]) {
      const { service } = buildService(
        buildStaffUser({
          memberships: [buildMembership({ branch: branchOne, role })],
        }),
      );

      await expect(
        service.can('staff-1', 'owner_analytics.read', {
          branchId: branchOne.id,
        }),
      ).resolves.toMatchObject({
        allowed: true,
        reason: 'permission_granted_by_branch_membership',
      });
    }
  });

  it('denies cashier owner analytics while preserving cashier bill operations', async () => {
    const { service } = buildService(
      buildStaffUser({
        memberships: [
          buildMembership({ branch: branchOne, role: StaffRole.cashier }),
        ],
      }),
    );

    await expect(
      service.can('staff-1', 'owner_analytics.read', {
        branchId: branchOne.id,
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: 'permission_not_granted',
    });

    for (const permission of [
      'orders.cashier_review',
      'bills.read',
      'bills.present',
      'bills.pay',
    ] as const) {
      await expect(
        service.can('staff-1', permission, {
          branchId: branchOne.id,
        }),
      ).resolves.toMatchObject({
        allowed: true,
        reason: 'permission_granted_by_branch_membership',
      });
    }
  });

  it('allows branch managers to manage tenant onboarding for their branch', async () => {
    const { service } = buildService(
      buildStaffUser({
        memberships: [
          buildMembership({ branch: branchOne, role: StaffRole.branch_manager }),
        ],
      }),
    );

    for (const permission of [
      'tenant_onboarding.read',
      'tenant_onboarding.manage',
      'staff.manage',
    ] as const) {
      await expect(
        service.can('staff-1', permission, {
          branchId: branchOne.id,
        }),
      ).resolves.toMatchObject({
        allowed: true,
        reason: 'permission_granted_by_branch_membership',
      });
    }
  });

  it('denies cashier tenant onboarding management', async () => {
    const { service } = buildService(
      buildStaffUser({
        memberships: [
          buildMembership({ branch: branchOne, role: StaffRole.cashier }),
        ],
      }),
    );

    await expect(
      service.can('staff-1', 'tenant_onboarding.manage', {
        branchId: branchOne.id,
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: 'permission_not_granted',
    });
  });
});
