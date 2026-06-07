import { ForbiddenException } from "@nestjs/common";
import {
  CompanyStatus,
  CompanySubscriptionStatus,
  SaasFeatureKey,
  SaasPlanStatus,
} from "@prisma/client";
import { SaasService } from "./saas.service";

const now = new Date("2026-06-05T10:00:00.000Z");
const company = {
  id: "company-1",
  name: "Balcona",
  slug: "balcona",
  status: CompanyStatus.active,
};

function saasPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    code: "starter",
    name: "Starter",
    status: SaasPlanStatus.active,
    description: "Starter plan",
    monthlyPriceMinor: 99000,
    currency: "EGP",
    maxBranches: 1,
    maxTables: 2,
    maxStaffUsers: 2,
    maxMenuItems: 3,
    maxInventoryItems: 4,
    maxAiMessagesPerMonth: 5,
    setupEnabled: true,
    kdsEnabled: true,
    inventoryEnabled: true,
    onlinePaymentsEnabled: true,
    ownerAnalyticsEnabled: true,
    aiWaiterEnabled: true,
    multiBranchEnabled: false,
    advancedReportsEnabled: false,
    sortOrder: 10,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function subscription(overrides: Record<string, unknown> = {}) {
  const { plan: planOverrides, ...subscriptionOverrides } = overrides;

  return {
    id: "subscription-1",
    companyId: company.id,
    planId: "plan-1",
    status: CompanySubscriptionStatus.active,
    currentPeriodStart: now,
    currentPeriodEnd: null,
    trialEndsAt: null,
    suspendedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    plan: saasPlan(planOverrides as Record<string, unknown> | undefined),
    ...subscriptionOverrides,
  };
}

function createService({
  subscriptionRecord = subscription(),
  counts = {},
  environment = "development",
}: {
  subscriptionRecord?: ReturnType<typeof subscription> | null;
  counts?: Partial<{
    branches: number;
    tables: number;
    staffUsers: number;
    menuItems: number;
    inventoryItems: number;
    aiMessages: number;
    onlinePayments: number;
  }>;
  environment?: string;
} = {}) {
  const prisma = {
    company: { findUnique: jest.fn().mockResolvedValue(company) },
    saasPlan: { findMany: jest.fn(), findUnique: jest.fn() },
    companySubscription: {
      findUnique: jest.fn().mockResolvedValue(subscriptionRecord),
      upsert: jest.fn(),
    },
    companyPlanLimitOverride: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    branch: {
      count: jest.fn().mockResolvedValue(counts.branches ?? 0),
      findUnique: jest.fn(),
    },
    cafeTable: { count: jest.fn().mockResolvedValue(counts.tables ?? 0) },
    staffMembership: {
      findMany: jest.fn().mockResolvedValue(
        Array.from({ length: counts.staffUsers ?? 0 }, (_, index) => ({
          staffUserId: `staff-${index}`,
        })),
      ),
    },
    menuItem: { count: jest.fn().mockResolvedValue(counts.menuItems ?? 0) },
    inventoryItem: {
      count: jest.fn().mockResolvedValue(counts.inventoryItems ?? 0),
    },
    aiWaiterMessage: {
      count: jest.fn().mockResolvedValue(counts.aiMessages ?? 0),
    },
    onlinePaymentIntent: {
      count: jest.fn().mockResolvedValue(counts.onlinePayments ?? 0),
    },
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "staffAuth.devBootstrapEnabled") {
        return true;
      }

      if (key === "app.environment") {
        return environment;
      }

      return undefined;
    }),
  };

  return {
    service: new SaasService(prisma as never, configService as never),
    prisma,
  };
}

describe("SaasService", () => {
  it("returns an unconfigured warning when a company has no subscription", async () => {
    const { service } = createService({ subscriptionRecord: null });

    const result = await service.getCompanySaasStatus(company.id);

    expect(result.subscription).toBeNull();
    expect(result.plan).toBeNull();
    expect(result.entitlements.setup).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "subscription_unconfigured" }),
      ]),
    );
  });

  it("computes usage warnings and exceeded limits from backend counts", async () => {
    const { service } = createService({
      counts: {
        tables: 2,
        menuItems: 4,
        aiMessages: 5,
      },
    });

    const result = await service.getCompanySaasStatus(company.id);

    expect(result.usage.tables.status).toBe("warning");
    expect(result.usage.menuItems.status).toBe("exceeded");
    expect(result.usage.aiMessagesThisMonth.status).toBe("warning");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metricKey: "menuItems" }),
      ]),
    );
  });

  it("treats null limits as unlimited", async () => {
    const { service } = createService({
      subscriptionRecord: subscription({
        plan: { maxTables: null },
      }),
      counts: { tables: 500 },
    });

    const result = await service.assertWithinLimit(company.id, "maxTables", 50);

    expect(result.usage.tables.status).toBe("unlimited");
    expect(result.usage.tables.remaining).toBeNull();
  });

  it("rejects disabled features with a stable message", async () => {
    const { service } = createService({
      subscriptionRecord: subscription({
        plan: { inventoryEnabled: false },
      }),
    });

    await expect(
      service.assertCompanyFeatureEnabled(
        company.id,
        SaasFeatureKey.inventory,
      ),
    ).rejects.toThrow("Inventory is not enabled on this plan.");
  });

  it("blocks write checks for suspended subscriptions", async () => {
    const { service } = createService({
      subscriptionRecord: subscription({
        status: CompanySubscriptionStatus.suspended,
      }),
    });

    await expect(
      service.assertCompanyFeatureEnabled(company.id, SaasFeatureKey.setup),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects limit writes when the next increment would exceed the plan", async () => {
    const { service } = createService({ counts: { tables: 2 } });

    await expect(
      service.assertWithinLimit(company.id, "maxTables", 1),
    ).rejects.toThrow("Table limit reached for this company plan.");
  });

  it("blocks development plan assignment in staging runtime", async () => {
    const { service, prisma } = createService({ environment: "staging" });

    await expect(
      service.assignCompanyPlanForDev(company.id, { planCode: "starter" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.saasPlan.findUnique).not.toHaveBeenCalled();
  });
});
