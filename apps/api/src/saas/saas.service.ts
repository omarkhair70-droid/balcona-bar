import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CompanySubscriptionStatus,
  Prisma,
  SaasFeatureKey,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AssignCompanyPlanDto } from "./dto/assign-company-plan.dto";

const ACTIVE_SUBSCRIPTION_STATUSES: readonly CompanySubscriptionStatus[] = [
  CompanySubscriptionStatus.trialing,
  CompanySubscriptionStatus.active,
  CompanySubscriptionStatus.past_due,
];
const BLOCKING_SUBSCRIPTION_STATUSES: readonly CompanySubscriptionStatus[] = [
  CompanySubscriptionStatus.suspended,
  CompanySubscriptionStatus.cancelled,
];
const USAGE_WARNING_RATIO = 0.8;

const planSelect = {
  id: true,
  code: true,
  name: true,
  status: true,
  description: true,
  monthlyPriceMinor: true,
  currency: true,
  maxBranches: true,
  maxTables: true,
  maxStaffUsers: true,
  maxMenuItems: true,
  maxInventoryItems: true,
  maxAiMessagesPerMonth: true,
  setupEnabled: true,
  kdsEnabled: true,
  inventoryEnabled: true,
  onlinePaymentsEnabled: true,
  ownerAnalyticsEnabled: true,
  aiWaiterEnabled: true,
  multiBranchEnabled: true,
  advancedReportsEnabled: true,
  sortOrder: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SaasPlanSelect;

const subscriptionSelect = {
  id: true,
  companyId: true,
  planId: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  trialEndsAt: true,
  suspendedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  plan: { select: planSelect },
} satisfies Prisma.CompanySubscriptionSelect;

const companySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
} satisfies Prisma.CompanySelect;

const branchSelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  status: true,
  company: { select: companySelect },
} satisfies Prisma.BranchSelect;

type SaasPlanRecord = Prisma.SaasPlanGetPayload<{ select: typeof planSelect }>;
type CompanySubscriptionRecord = Prisma.CompanySubscriptionGetPayload<{
  select: typeof subscriptionSelect;
}>;
type CompanyLimitOverrideRecord = Prisma.CompanyPlanLimitOverrideGetPayload<{
  select: {
    key: true;
    valueInt: true;
    valueBoolean: true;
    note: true;
  };
}>;
type UsageStatus = "ok" | "warning" | "exceeded" | "unlimited";
type LimitKey =
  | "maxBranches"
  | "maxTables"
  | "maxStaffUsers"
  | "maxMenuItems"
  | "maxInventoryItems"
  | "maxAiMessagesPerMonth";

export type SaasUsageMetricKey =
  | "branches"
  | "tables"
  | "staffUsers"
  | "menuItems"
  | "inventoryItems"
  | "aiMessagesThisMonth"
  | "onlinePaymentsThisMonth";

export type SaasEntitlements = Record<
  | "setup"
  | "kds"
  | "inventory"
  | "onlinePayments"
  | "ownerAnalytics"
  | "aiWaiter"
  | "multiBranch"
  | "advancedReports",
  boolean
>;

export type SaasUsageMetric = {
  key: SaasUsageMetricKey;
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  status: UsageStatus;
};

export type SaasStatusResult = {
  company: Prisma.CompanyGetPayload<{ select: typeof companySelect }>;
  branch?: Prisma.BranchGetPayload<{ select: typeof branchSelect }> | null;
  subscription: Omit<CompanySubscriptionRecord, "plan"> | null;
  plan: SaasPlanRecord | null;
  entitlements: SaasEntitlements;
  usage: Record<SaasUsageMetricKey, SaasUsageMetric>;
  limits: Record<LimitKey, number | null>;
  warnings: Array<{
    code: string;
    message: string;
    severity: "warning";
    metricKey?: SaasUsageMetricKey;
  }>;
  blockers: Array<{
    code: string;
    message: string;
    severity: "blocker";
    metricKey?: SaasUsageMetricKey;
  }>;
};

@Injectable()
export class SaasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getPlans() {
    const plans = await this.prisma.saasPlan.findMany({
      where: { status: { not: "archived" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: planSelect,
    });

    return { plans };
  }

  async getCompanySaasStatus(companyId: string): Promise<SaasStatusResult> {
    const company = await this.findCompanyOrThrow(companyId);

    return this.buildCompanySaasStatus(company);
  }

  async getBranchSaasStatus(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: branchSelect,
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    return {
      ...(await this.buildCompanySaasStatus(branch.company)),
      branch,
    };
  }

  async assignCompanyPlanForDev(
    companyId: string,
    body: AssignCompanyPlanDto,
  ) {
    this.assertDevPlanAssignmentAllowed();
    const [company, plan] = await Promise.all([
      this.findCompanyOrThrow(companyId),
      this.prisma.saasPlan.findUnique({
        where: { code: body.planCode },
        select: planSelect,
      }),
    ]);

    if (!plan) {
      throw new NotFoundException("SaaS plan not found");
    }

    await this.prisma.companySubscription.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        planId: plan.id,
        status: body.status ?? CompanySubscriptionStatus.active,
        currentPeriodStart: new Date(),
        metadata: { source: "dev_assign_plan" },
      },
      update: {
        planId: plan.id,
        status: body.status ?? CompanySubscriptionStatus.active,
        metadata: { source: "dev_assign_plan" },
      },
    });

    return this.getCompanySaasStatus(company.id);
  }

  async assertCompanyFeatureEnabled(
    companyId: string,
    featureKey: SaasFeatureKey,
  ) {
    const status = await this.getCompanySaasStatus(companyId);
    this.assertSubscriptionAllowsWrites(status);
    const entitlementKey = this.featureToEntitlementKey(featureKey);

    if (!status.entitlements[entitlementKey]) {
      throw new ForbiddenException(this.featureDisabledMessage(featureKey));
    }

    return status;
  }

  async assertWithinLimit(
    companyId: string,
    limitKey: LimitKey,
    nextIncrement = 1,
  ) {
    const status = await this.getCompanySaasStatus(companyId);
    this.assertSubscriptionAllowsWrites(status);
    const metric = status.usage[this.limitToMetricKey(limitKey)];

    if (metric.limit === null) {
      return status;
    }

    if (metric.used + nextIncrement > metric.limit) {
      throw new BadRequestException(this.limitReachedMessage(limitKey));
    }

    return status;
  }

  private async buildCompanySaasStatus(
    company: Prisma.CompanyGetPayload<{ select: typeof companySelect }>,
  ): Promise<SaasStatusResult> {
    const [subscription, overrides, usageCounts] = await Promise.all([
      this.prisma.companySubscription.findUnique({
        where: { companyId: company.id },
        select: subscriptionSelect,
      }),
      this.prisma.companyPlanLimitOverride.findMany({
        where: { companyId: company.id },
        select: {
          key: true,
          valueInt: true,
          valueBoolean: true,
          note: true,
        },
      }),
      this.getUsageCounts(company.id),
    ]);
    const plan = subscription?.plan ?? null;
    const limits = this.buildLimits(plan, overrides);
    const entitlements = this.buildEntitlements(plan, overrides);
    const usage = this.buildUsage(limits, usageCounts);
    const warnings = this.buildWarnings(subscription, usage);
    const blockers = this.buildBlockers(subscription, usage);

    return {
      company,
      subscription: subscription
        ? {
            id: subscription.id,
            companyId: subscription.companyId,
            planId: subscription.planId,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            trialEndsAt: subscription.trialEndsAt,
            suspendedAt: subscription.suspendedAt,
            cancelledAt: subscription.cancelledAt,
            cancellationReason: subscription.cancellationReason,
            metadata: subscription.metadata,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt,
          }
        : null,
      plan,
      entitlements,
      usage,
      limits,
      warnings,
      blockers,
    };
  }

  private async getUsageCounts(companyId: string) {
    const monthStart = this.startOfCurrentMonth();
    const [
      branchCount,
      tableCount,
      staffMemberships,
      menuItemCount,
      inventoryItemCount,
      aiMessagesThisMonth,
      onlinePaymentsThisMonth,
    ] = await Promise.all([
      this.prisma.branch.count({ where: { companyId } }),
      this.prisma.cafeTable.count({ where: { branch: { companyId } } }),
      this.prisma.staffMembership.findMany({
        where: { companyId, status: "active" },
        distinct: ["staffUserId"],
        select: { staffUserId: true },
      }),
      this.prisma.menuItem.count({
        where: { companyId, status: { not: "archived" } },
      }),
      this.prisma.inventoryItem.count({
        where: { companyId, status: { not: "archived" } },
      }),
      this.prisma.aiWaiterMessage.count({
        where: { companyId, createdAt: { gte: monthStart } },
      }),
      this.prisma.onlinePaymentIntent.count({
        where: {
          companyId,
          status: "succeeded",
          succeededAt: { gte: monthStart },
        },
      }),
    ]);

    return {
      branchCount,
      tableCount,
      staffUserCount: staffMemberships.length,
      menuItemCount,
      inventoryItemCount,
      aiMessagesThisMonth,
      onlinePaymentsThisMonth,
    };
  }

  private buildLimits(
    plan: SaasPlanRecord | null,
    overrides: CompanyLimitOverrideRecord[],
  ): Record<LimitKey, number | null> {
    return {
      maxBranches: this.overrideInt(plan?.maxBranches ?? null, overrides, "maxBranches"),
      maxTables: this.overrideInt(plan?.maxTables ?? null, overrides, "maxTables"),
      maxStaffUsers: this.overrideInt(
        plan?.maxStaffUsers ?? null,
        overrides,
        "maxStaffUsers",
      ),
      maxMenuItems: this.overrideInt(
        plan?.maxMenuItems ?? null,
        overrides,
        "maxMenuItems",
      ),
      maxInventoryItems: this.overrideInt(
        plan?.maxInventoryItems ?? null,
        overrides,
        "maxInventoryItems",
      ),
      maxAiMessagesPerMonth: this.overrideInt(
        plan?.maxAiMessagesPerMonth ?? null,
        overrides,
        "maxAiMessagesPerMonth",
      ),
    };
  }

  private buildEntitlements(
    plan: SaasPlanRecord | null,
    overrides: CompanyLimitOverrideRecord[],
  ): SaasEntitlements {
    return {
      setup: this.overrideBoolean(plan?.setupEnabled ?? false, overrides, "setup"),
      kds: this.overrideBoolean(plan?.kdsEnabled ?? false, overrides, "kds"),
      inventory: this.overrideBoolean(
        plan?.inventoryEnabled ?? false,
        overrides,
        "inventory",
      ),
      onlinePayments: this.overrideBoolean(
        plan?.onlinePaymentsEnabled ?? false,
        overrides,
        "online_payments",
      ),
      ownerAnalytics: this.overrideBoolean(
        plan?.ownerAnalyticsEnabled ?? false,
        overrides,
        "owner_analytics",
      ),
      aiWaiter: this.overrideBoolean(
        plan?.aiWaiterEnabled ?? false,
        overrides,
        "ai_waiter",
      ),
      multiBranch: this.overrideBoolean(
        plan?.multiBranchEnabled ?? false,
        overrides,
        "multi_branch",
      ),
      advancedReports: this.overrideBoolean(
        plan?.advancedReportsEnabled ?? false,
        overrides,
        "advanced_reports",
      ),
    };
  }

  private buildUsage(
    limits: Record<LimitKey, number | null>,
    usageCounts: Awaited<ReturnType<SaasService["getUsageCounts"]>>,
  ): Record<SaasUsageMetricKey, SaasUsageMetric> {
    return {
      branches: this.metric(
        "branches",
        "Branches",
        usageCounts.branchCount,
        limits.maxBranches,
      ),
      tables: this.metric("tables", "Tables", usageCounts.tableCount, limits.maxTables),
      staffUsers: this.metric(
        "staffUsers",
        "Staff users",
        usageCounts.staffUserCount,
        limits.maxStaffUsers,
      ),
      menuItems: this.metric(
        "menuItems",
        "Menu items",
        usageCounts.menuItemCount,
        limits.maxMenuItems,
      ),
      inventoryItems: this.metric(
        "inventoryItems",
        "Inventory items",
        usageCounts.inventoryItemCount,
        limits.maxInventoryItems,
      ),
      aiMessagesThisMonth: this.metric(
        "aiMessagesThisMonth",
        "AI messages this month",
        usageCounts.aiMessagesThisMonth,
        limits.maxAiMessagesPerMonth,
      ),
      onlinePaymentsThisMonth: this.metric(
        "onlinePaymentsThisMonth",
        "Online payments this month",
        usageCounts.onlinePaymentsThisMonth,
        null,
      ),
    };
  }

  private metric(
    key: SaasUsageMetricKey,
    label: string,
    used: number,
    limit: number | null,
  ): SaasUsageMetric {
    if (limit === null) {
      return { key, label, used, limit, remaining: null, status: "unlimited" };
    }

    const remaining = Math.max(limit - used, 0);
    const status =
      used > limit
        ? "exceeded"
        : used >= limit * USAGE_WARNING_RATIO
          ? "warning"
          : "ok";

    return { key, label, used, limit, remaining, status };
  }

  private buildWarnings(
    subscription: CompanySubscriptionRecord | null,
    usage: Record<SaasUsageMetricKey, SaasUsageMetric>,
  ): SaasStatusResult["warnings"] {
    const warnings: SaasStatusResult["warnings"] = [];

    if (!subscription) {
      warnings.push({
        code: "subscription_unconfigured",
        severity: "warning",
        message: "Company subscription is not configured yet.",
      });
    } else if (subscription.status === CompanySubscriptionStatus.past_due) {
      warnings.push({
        code: "subscription_past_due",
        severity: "warning",
        message:
          "Subscription is past due. Existing operations remain available in this phase.",
      });
    }

    for (const metric of Object.values(usage)) {
      if (metric.status === "warning") {
        warnings.push({
          code: `${metric.key}_near_limit`,
          severity: "warning",
          metricKey: metric.key,
          message: `${metric.label} usage is close to the current plan limit.`,
        });
      }
    }

    return warnings;
  }

  private buildBlockers(
    subscription: CompanySubscriptionRecord | null,
    usage: Record<SaasUsageMetricKey, SaasUsageMetric>,
  ): SaasStatusResult["blockers"] {
    const blockers: SaasStatusResult["blockers"] = [];

    if (
      subscription &&
      BLOCKING_SUBSCRIPTION_STATUSES.includes(subscription.status)
    ) {
      blockers.push({
        code: `subscription_${subscription.status}`,
        severity: "blocker",
        message: `Subscription is ${subscription.status}. Plan-gated write features are blocked.`,
      });
    }

    for (const metric of Object.values(usage)) {
      if (metric.status === "exceeded") {
        blockers.push({
          code: `${metric.key}_limit_exceeded`,
          severity: "blocker",
          metricKey: metric.key,
          message: `${metric.label} usage exceeds the current plan limit.`,
        });
      }
    }

    return blockers;
  }

  private assertSubscriptionAllowsWrites(status: SaasStatusResult) {
    if (!status.subscription) {
      throw new ForbiddenException("Company subscription is not configured.");
    }

    if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(status.subscription.status)) {
      throw new ForbiddenException(
        `Subscription is ${status.subscription.status}. Plan-gated write features are blocked.`,
      );
    }
  }

  private featureToEntitlementKey(featureKey: SaasFeatureKey): keyof SaasEntitlements {
    const mapping: Record<SaasFeatureKey, keyof SaasEntitlements> = {
      [SaasFeatureKey.setup]: "setup",
      [SaasFeatureKey.kds]: "kds",
      [SaasFeatureKey.inventory]: "inventory",
      [SaasFeatureKey.online_payments]: "onlinePayments",
      [SaasFeatureKey.owner_analytics]: "ownerAnalytics",
      [SaasFeatureKey.ai_waiter]: "aiWaiter",
      [SaasFeatureKey.multi_branch]: "multiBranch",
      [SaasFeatureKey.advanced_reports]: "advancedReports",
    };

    return mapping[featureKey];
  }

  private limitToMetricKey(limitKey: LimitKey): SaasUsageMetricKey {
    const mapping: Record<LimitKey, SaasUsageMetricKey> = {
      maxBranches: "branches",
      maxTables: "tables",
      maxStaffUsers: "staffUsers",
      maxMenuItems: "menuItems",
      maxInventoryItems: "inventoryItems",
      maxAiMessagesPerMonth: "aiMessagesThisMonth",
    };

    return mapping[limitKey];
  }

  private featureDisabledMessage(featureKey: SaasFeatureKey) {
    const messages: Record<SaasFeatureKey, string> = {
      [SaasFeatureKey.setup]: "Your current plan does not include setup tools.",
      [SaasFeatureKey.kds]: "Your current plan does not include KDS.",
      [SaasFeatureKey.inventory]: "Inventory is not enabled on this plan.",
      [SaasFeatureKey.online_payments]:
        "Your current plan does not include online payments.",
      [SaasFeatureKey.owner_analytics]:
        "Owner analytics is not enabled on this plan.",
      [SaasFeatureKey.ai_waiter]:
        "AI waiter is not enabled on this plan.",
      [SaasFeatureKey.multi_branch]:
        "Multi-branch management is not enabled on this plan.",
      [SaasFeatureKey.advanced_reports]:
        "Advanced reports are not enabled on this plan.",
    };

    return messages[featureKey];
  }

  private limitReachedMessage(limitKey: LimitKey) {
    const messages: Record<LimitKey, string> = {
      maxBranches: "Branch limit reached for this company plan.",
      maxTables: "Table limit reached for this company plan.",
      maxStaffUsers: "Staff user limit reached for this company plan.",
      maxMenuItems: "Menu item limit reached for this company plan.",
      maxInventoryItems:
        "Inventory item limit reached for this company plan.",
      maxAiMessagesPerMonth:
        "AI waiter message limit reached for this company plan.",
    };

    return messages[limitKey];
  }

  private overrideInt(
    fallback: number | null,
    overrides: CompanyLimitOverrideRecord[],
    key: string,
  ) {
    const override = overrides.find((entry) => entry.key === key);

    return override?.valueInt ?? fallback;
  }

  private overrideBoolean(
    fallback: boolean,
    overrides: CompanyLimitOverrideRecord[],
    key: string,
  ) {
    const override = overrides.find((entry) => entry.key === key);

    return override?.valueBoolean ?? fallback;
  }

  private async findCompanyOrThrow(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: companySelect,
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return company;
  }

  private startOfCurrentMonth() {
    const now = new Date();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private assertDevPlanAssignmentAllowed() {
    const devBootstrapEnabled = this.configService.get<boolean>(
      "staffAuth.devBootstrapEnabled",
    );
    const environment =
      this.configService.get<string>("app.environment") ?? "development";

    if (!devBootstrapEnabled || environment === "production") {
      throw new ForbiddenException(
        "Development SaaS plan assignment is not enabled.",
      );
    }
  }
}
