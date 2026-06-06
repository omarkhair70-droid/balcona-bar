import { BadRequestException } from "@nestjs/common";
import {
  BranchStatus,
  CompanyStatus,
  CompanySubscriptionStatus,
  SaasPlanStatus,
  StaffRole,
  StaffStatus,
  TableStatus,
} from "@prisma/client";
import { PlatformService } from "./platform.service";

const now = new Date("2026-06-06T10:00:00.000Z");

const company = {
  id: "company-1",
  name: "Test Cafe",
  slug: "test-cafe",
  status: CompanyStatus.active,
  createdAt: now,
  updatedAt: now,
};

const branch = {
  id: "branch-1",
  companyId: company.id,
  name: "Main",
  slug: "main",
  address: "1 Test Street",
  status: BranchStatus.active,
  createdAt: now,
  updatedAt: now,
};

const floor = {
  id: "floor-1",
  branchId: branch.id,
  name: "Ground Floor",
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
};

const plan = {
  id: "plan-1",
  code: "starter",
  name: "Starter",
  status: SaasPlanStatus.active,
  description: "Starter plan",
  monthlyPriceMinor: 150000,
  currency: "EGP",
  maxBranches: 1,
  maxTables: 20,
  maxStaffUsers: 8,
  maxMenuItems: 80,
  maxInventoryItems: 75,
  maxAiMessagesPerMonth: 1000,
  setupEnabled: true,
  kdsEnabled: true,
  inventoryEnabled: false,
  onlinePaymentsEnabled: false,
  ownerAnalyticsEnabled: true,
  aiWaiterEnabled: true,
  multiBranchEnabled: false,
  advancedReportsEnabled: false,
  sortOrder: 2,
  metadata: null,
  createdAt: now,
  updatedAt: now,
};

const subscription = {
  id: "subscription-1",
  companyId: company.id,
  planId: plan.id,
  status: CompanySubscriptionStatus.trialing,
  currentPeriodStart: now,
  currentPeriodEnd: null,
  trialEndsAt: null,
  suspendedAt: null,
  cancelledAt: null,
  cancellationReason: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
  plan,
};

const ownerStaffUser = {
  id: "staff-owner-1",
  email: "owner@test.local",
  name: "Owner",
  status: StaffStatus.active,
  passwordSetAt: null,
  lastLoginAt: null,
  createdAt: now,
  updatedAt: now,
};

const ownerMembership = {
  id: "membership-owner-1",
  staffUserId: ownerStaffUser.id,
  companyId: company.id,
  branchId: null,
  role: StaffRole.owner,
  status: StaffStatus.active,
  createdAt: now,
  updatedAt: now,
  staffUser: ownerStaffUser,
};

const bootstrapInput = {
  company: {
    name: "Test Cafe",
    slug: "Test-Cafe",
  },
  owner: {
    name: "Owner",
    email: "Owner@Test.Local",
  },
  branch: {
    name: "Main",
    slug: "Main",
    address: "1 Test Street",
  },
  subscription: {
    planCode: "starter" as const,
    status: "trialing" as const,
  },
  starterTables: {
    enabled: true,
    floorLabel: "Ground Floor",
    tablePrefix: "T",
    startNumber: 1,
    count: 2,
    seats: 4,
  },
};

function createPrisma(overrides: Record<string, unknown> = {}) {
  const tx = {
    company: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(company),
      findMany: jest.fn(),
    },
    saasPlan: {
      findUnique: jest.fn().mockResolvedValue(plan),
      findMany: jest.fn(),
    },
    companySubscription: {
      create: jest.fn().mockResolvedValue(subscription),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    branch: {
      create: jest.fn().mockResolvedValue(branch),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
    },
    staffUser: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(ownerStaffUser),
      update: jest.fn(),
    },
    staffMembership: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(ownerMembership),
      findMany: jest.fn().mockResolvedValue([]),
    },
    floor: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(floor),
    },
    cafeTable: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }) =>
        Promise.resolve({
          id: `table-${data.code}`,
          branchId: data.branchId,
          floorId: data.floorId,
          code: data.code,
          displayName: data.displayName,
          capacity: data.capacity,
          qrToken: data.qrToken,
          status: TableStatus.active,
          createdAt: now,
          updatedAt: now,
          floor,
        }),
      ),
      count: jest.fn().mockResolvedValue(0),
    },
    companyPlanLimitOverride: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    menuItem: { count: jest.fn().mockResolvedValue(0) },
    inventoryItem: { count: jest.fn().mockResolvedValue(0) },
    aiWaiterMessage: { count: jest.fn().mockResolvedValue(0) },
    onlinePaymentIntent: { count: jest.fn().mockResolvedValue(0) },
    platformAuditEvent: {
      create: jest.fn().mockResolvedValue({ id: "platform-audit-1" }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback) => callback(tx)),
    ...overrides,
  };

  return { prisma, tx };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const { prisma, tx } = createPrisma(overrides);
  const saasService = {
    assertWithinLimit: jest.fn().mockResolvedValue({}),
    getCompanySaasStatus: jest.fn().mockResolvedValue({
      company,
      subscription,
      plan,
      entitlements: {},
      usage: {},
      limits: {},
      warnings: [],
      blockers: [],
    }),
  };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === "staffAuth.devBootstrapEnabled") {
        return true;
      }

      return fallback;
    }),
  };

  return {
    service: new PlatformService(
      prisma as never,
      configService as never,
      saasService as never,
    ),
    prisma,
    tx,
    saasService,
  };
}

describe("PlatformService", () => {
  it("bootstraps a company, branch, subscription, owner membership, tables, QR, and audit event", async () => {
    const { service, tx, saasService } = buildService();

    const result = await service.bootstrapCompany(
      bootstrapInput,
      "platform-admin-1",
    );

    expect(tx.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "test-cafe",
          status: CompanyStatus.active,
        }),
      }),
    );
    expect(tx.branch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: "main",
          status: BranchStatus.active,
        }),
      }),
    );
    expect(tx.companySubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planId: plan.id,
          status: CompanySubscriptionStatus.trialing,
        }),
      }),
    );
    expect(tx.staffUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "owner@test.local",
        }),
      }),
    );
    expect(tx.staffMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branchId: null,
          role: StaffRole.owner,
        }),
      }),
    );
    expect(result.starterTables?.created.map((table) => table.qrToken)).toEqual([
      "main-t01",
      "main-t02",
    ]);
    expect(result.customerQrExamples[0]).toMatchObject({
      qrToken: "main-t01",
      customerUrl: "/customer/table/main-t01",
    });
    expect(saasService.assertWithinLimit).toHaveBeenCalledWith(
      company.id,
      "maxTables",
      2,
      tx,
    );
    expect(tx.platformAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "company_bootstrapped",
          targetType: "company",
          targetId: company.id,
        }),
      }),
    );
  });

  it("rejects duplicate company slugs clearly", async () => {
    const { service, tx } = buildService();
    tx.company.findUnique.mockResolvedValueOnce({ id: "existing-company" });

    await expect(
      service.bootstrapCompany(bootstrapInput, "platform-admin-1"),
    ).rejects.toThrow("Company slug already exists");
    expect(tx.company.create).not.toHaveBeenCalled();
  });

  it("reuses an existing owner staff user and owner membership safely", async () => {
    const { service, tx, saasService } = buildService();
    tx.staffUser.findUnique.mockResolvedValue(ownerStaffUser);
    tx.staffUser.update.mockResolvedValue({
      ...ownerStaffUser,
      name: "Existing Owner",
    });
    tx.staffMembership.findFirst
      .mockResolvedValueOnce({ id: ownerMembership.id })
      .mockResolvedValueOnce(ownerMembership);

    const result = await service.bootstrapCompany(
      {
        ...bootstrapInput,
        owner: { email: ownerStaffUser.email, name: "Existing Owner" },
      },
      "platform-admin-1",
    );

    expect(tx.staffUser.create).not.toHaveBeenCalled();
    expect(tx.staffMembership.create).not.toHaveBeenCalled();
    expect(result.ownerMembership.id).toBe(ownerMembership.id);
    expect(saasService.assertWithinLimit).not.toHaveBeenCalledWith(
      company.id,
      "maxStaffUsers",
      1,
      tx,
    );
  });

  it("enforces table limits before creating starter tables", async () => {
    const { service, tx, saasService } = buildService();
    saasService.assertWithinLimit.mockImplementation(
      (_companyId: string, limitKey: string) => {
        if (limitKey === "maxTables") {
          throw new BadRequestException(
            "Table limit reached for this company plan.",
          );
        }

        return Promise.resolve({});
      },
    );

    await expect(
      service.bootstrapCompany(bootstrapInput, "platform-admin-1"),
    ).rejects.toThrow("Table limit reached for this company plan.");
    expect(tx.cafeTable.create).not.toHaveBeenCalled();
    expect(tx.platformAuditEvent.create).not.toHaveBeenCalled();
  });

  it("enforces staff user limits before creating the owner user", async () => {
    const { service, tx, saasService } = buildService();
    saasService.assertWithinLimit.mockImplementation(
      (_companyId: string, limitKey: string) => {
        if (limitKey === "maxStaffUsers") {
          throw new BadRequestException(
            "Staff user limit reached for this company plan.",
          );
        }

        return Promise.resolve({});
      },
    );

    await expect(
      service.bootstrapCompany(bootstrapInput, "platform-admin-1"),
    ).rejects.toThrow("Staff user limit reached for this company plan.");
    expect(tx.staffUser.create).not.toHaveBeenCalled();
    expect(tx.staffMembership.create).not.toHaveBeenCalled();
  });

  it("fails transactionally before writes when the plan is invalid", async () => {
    const { service, tx } = buildService();
    tx.saasPlan.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.bootstrapCompany(bootstrapInput, "platform-admin-1"),
    ).rejects.toThrow("Active SaaS plan not found");
    expect(tx.company.create).not.toHaveBeenCalled();
    expect(tx.platformAuditEvent.create).not.toHaveBeenCalled();
  });

  it("updates a company subscription to suspended and returns SaaS blockers", async () => {
    const { service, prisma, saasService } = buildService();
    const suspendedSubscription = {
      ...subscription,
      status: CompanySubscriptionStatus.suspended,
    };
    prisma.company.findUnique.mockResolvedValue(company);
    prisma.companySubscription.findUnique.mockResolvedValue(subscription);
    prisma.companySubscription.upsert.mockResolvedValue(suspendedSubscription);
    saasService.getCompanySaasStatus.mockResolvedValueOnce({
      company,
      subscription: suspendedSubscription,
      plan,
      entitlements: {},
      usage: {},
      limits: {},
      warnings: [],
      blockers: [
        {
          code: "subscription_suspended",
          message:
            "Subscription is suspended. Plan-gated write features are blocked.",
          severity: "blocker",
        },
      ],
    });

    const result = await service.updateCompanySubscription(
      company.id,
      { status: "suspended" },
      "platform-admin-1",
    );

    expect(prisma.companySubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "suspended",
        }),
      }),
    );
    expect(result.subscription.status).toBe("suspended");
    expect(result.saas.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "subscription_suspended" }),
      ]),
    );
  });

  it("updates a company subscription to cancelled and returns SaaS blockers", async () => {
    const { service, prisma, saasService } = buildService();
    const cancelledSubscription = {
      ...subscription,
      status: CompanySubscriptionStatus.cancelled,
      cancellationReason: "Customer churned",
    };
    prisma.company.findUnique.mockResolvedValue(company);
    prisma.companySubscription.findUnique.mockResolvedValue(subscription);
    prisma.companySubscription.upsert.mockResolvedValue(cancelledSubscription);
    saasService.getCompanySaasStatus.mockResolvedValueOnce({
      company,
      subscription: cancelledSubscription,
      plan,
      entitlements: {},
      usage: {},
      limits: {},
      warnings: [],
      blockers: [
        {
          code: "subscription_cancelled",
          message:
            "Subscription is cancelled. Plan-gated write features are blocked.",
          severity: "blocker",
        },
      ],
    });

    const result = await service.updateCompanySubscription(
      company.id,
      { status: "cancelled", cancellationReason: "Customer churned" },
      "platform-admin-1",
    );

    expect(prisma.companySubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "cancelled",
          cancellationReason: "Customer churned",
        }),
      }),
    );
    expect(result.subscription.status).toBe("cancelled");
    expect(result.saas.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "subscription_cancelled" }),
      ]),
    );
  });
});
