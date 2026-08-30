import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BranchStatus,
  CompanyStatus,
  InventoryItemStatus,
  MenuItemStatus,
  ModifierGroupStatus,
  Prisma,
  SaasFeatureKey,
  StaffRole,
  StaffStatus,
  TableStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SaasService } from "../saas/saas.service";
import { StaffInvitesService } from "../staff-invites/staff-invites.service";
import { StaffAccessService } from "../staff/staff-access.service";
import {
  BulkCreateOnboardingTablesDto,
  CreateOnboardingFloorDto,
  InviteOnboardingStaffDto,
  UpdateBranchOnboardingProfileDto,
  UpdateCompanyOnboardingProfileDto,
  UpdateReadinessCheckDto,
} from "./dto/tenant-onboarding.dto";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const companySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySelect;

const branchSelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  address: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSelect;

const branchWithCompanySelect = {
  ...branchSelect,
  company: {
    select: companySelect,
  },
} satisfies Prisma.BranchSelect;

const floorSelect = {
  id: true,
  branchId: true,
  name: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FloorSelect;

const tableSelect = {
  id: true,
  branchId: true,
  floorId: true,
  code: true,
  displayName: true,
  capacity: true,
  qrToken: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  floor: {
    select: floorSelect,
  },
} satisfies Prisma.CafeTableSelect;

const staffUserSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  passwordSetAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffUserSelect;

const staffMembershipSelect = {
  id: true,
  staffUserId: true,
  companyId: true,
  branchId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  staffUser: {
    select: staffUserSelect,
  },
} satisfies Prisma.StaffMembershipSelect;

type CompanyRecord = Prisma.CompanyGetPayload<{ select: typeof companySelect }>;
type BranchRecord = Prisma.BranchGetPayload<{ select: typeof branchSelect }>;
type BranchWithCompanyRecord = Prisma.BranchGetPayload<{
  select: typeof branchWithCompanySelect;
}>;
type FloorRecord = Prisma.FloorGetPayload<{ select: typeof floorSelect }>;
type TableRecord = Prisma.CafeTableGetPayload<{ select: typeof tableSelect }>;
type StaffMembershipRecord = Prisma.StaffMembershipGetPayload<{
  select: typeof staffMembershipSelect;
}>;

type ReadinessStatus = "ready" | "missing" | "needs_attention" | "blocked";

type ChecklistItem = {
  key: string;
  label: string;
  status: ReadinessStatus;
  reason: string;
  actionHref?: string;
  metadata?: Record<string, unknown>;
};

type ReadinessSection = {
  key: string;
  label: string;
  status: ReadinessStatus;
  readyCount: number;
  totalCount: number;
  percentage: number;
  items: ChecklistItem[];
};

const qrTokenPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const criticalLaunchKeys = new Set([
  "company_profile",
  "branch_profile",
  "tables_created",
  "qr_links_ready",
  "owner_staff_ready",
  "cashier_staff_ready",
  "kitchen_staff_ready",
  "waiter_staff_ready",
  "menu_categories_ready",
  "menu_items_ready",
  "bills_payment_ready",
  "shifts_ready",
  "analytics_ready",
]);

@Injectable()
export class TenantOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly staffAccessService: StaffAccessService,
    private readonly saasService: SaasService,
    private readonly staffInvitesService: StaffInvitesService,
  ) {}

  async getCompanyOnboarding(companyId: string) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const [branches, memberships, categoryCount, activeItemCount] =
      await Promise.all([
        this.prisma.branch.findMany({
          where: { companyId: company.id },
          orderBy: [{ name: "asc" }],
          select: {
            ...branchSelect,
            _count: {
              select: {
                floors: true,
                tables: true,
              },
            },
          },
        }),
        this.prisma.staffMembership.findMany({
          where: { companyId: company.id, status: StaffStatus.active },
          select: staffMembershipSelect,
        }),
        this.prisma.menuCategory.count({
          where: { companyId: company.id, status: "active" },
        }),
        this.prisma.menuItem.count({
          where: { companyId: company.id, status: MenuItemStatus.active },
        }),
      ]);
    const roleCounts = this.countRoles(memberships);
    const companyProfileItems = this.getCompanyProfileItems(company);
    const branchesReady = branches.filter(
      (branch) => branch.status === BranchStatus.active,
    ).length;
    const items = [
      ...companyProfileItems,
      this.item(
        "branches_created",
        "Branches created",
        branches.length > 0,
        branches.length > 0
          ? `${branches.length} branch setup record${branches.length === 1 ? "" : "s"} found.`
          : "Create at least one branch before launch setup can continue.",
        "/staff/branches",
        { branchCount: branches.length },
      ),
      this.item(
        "active_branch_ready",
        "Active branch ready",
        branchesReady > 0,
        branchesReady > 0
          ? `${branchesReady} active branch${branchesReady === 1 ? "" : "es"} ready for setup.`
          : "At least one branch must be active before customer QR sessions can launch.",
        "/staff/branches",
        { activeBranchCount: branchesReady },
      ),
      this.item(
        "owner_staff_ready",
        "Owner or manager assigned",
        (roleCounts.owner ?? 0) + (roleCounts.branch_manager ?? 0) > 0,
        (roleCounts.owner ?? 0) + (roleCounts.branch_manager ?? 0) > 0
          ? "Owner or branch manager access is present."
          : "Add an owner or branch manager before launch.",
        "/staff/setup",
        {
          owners: roleCounts.owner ?? 0,
          branchManagers: roleCounts.branch_manager ?? 0,
        },
      ),
      this.item(
        "menu_items_ready",
        "Company menu has items",
        categoryCount > 0 && activeItemCount > 0,
        categoryCount > 0 && activeItemCount > 0
          ? `${activeItemCount} active menu item${activeItemCount === 1 ? "" : "s"} in ${categoryCount} active categor${categoryCount === 1 ? "y" : "ies"}.`
          : "Create active menu categories and items before customer ordering.",
        "/staff/menu",
        { categoryCount, activeItemCount },
      ),
    ];
    const summary = this.section("company_setup", "Company setup", items);

    return {
      company,
      branches: branches.map((branch) => ({
        id: branch.id,
        companyId: branch.companyId,
        name: branch.name,
        slug: branch.slug,
        address: branch.address,
        status: branch.status,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
        floorsCount: branch._count.floors,
        tablesCount: branch._count.tables,
      })),
      staff: {
        total: memberships.length,
        roleCounts,
        companyScopedCount: memberships.filter((entry) => !entry.branchId)
          .length,
        branchScopedCount: memberships.filter((entry) => entry.branchId).length,
      },
      menu: {
        activeCategoryCount: categoryCount,
        activeItemCount,
      },
      sections: [summary],
      launchSummary: this.launchSummary(items),
    };
  }

  async getBranchOnboarding(branchId: string) {
    const branch = await this.findBranchWithCompanyOrThrow(
      branchId,
      this.prisma,
    );

    return this.buildBranchOnboarding(branch);
  }

  async updateCompanyProfile(
    companyId: string,
    body: UpdateCompanyOnboardingProfileDto,
  ) {
    try {
      const existingCompany = await this.findCompanyOrThrow(
        companyId,
        this.prisma,
      );
      await this.saasService.assertCompanyFeatureEnabled(
        existingCompany.id,
        SaasFeatureKey.setup,
      );
      const data: Prisma.CompanyUpdateInput = {};

      if (body.name !== undefined) {
        data.name = body.name.trim();
      }

      if (body.slug !== undefined) {
        data.slug = body.slug.trim();
      }

      if (body.status !== undefined) {
        data.status = body.status;
      }

      const company = await this.prisma.company.update({
        where: { id: companyId },
        data,
        select: companySelect,
      });

      return {
        company,
        onboarding: await this.getCompanyOnboarding(company.id),
      };
    } catch (error) {
      this.handleKnownWriteError(error, "Company slug must be unique");
    }
  }

  async updateBranchProfile(
    branchId: string,
    body: UpdateBranchOnboardingProfileDto,
  ) {
    try {
      const branch = await this.findBranchOrThrow(branchId, this.prisma);
      await this.saasService.assertCompanyFeatureEnabled(
        branch.companyId,
        SaasFeatureKey.setup,
      );
      const data: Prisma.BranchUpdateInput = {};

      if (body.name !== undefined) {
        data.name = body.name.trim();
      }

      if (body.slug !== undefined) {
        data.slug = body.slug.trim();
      }

      if (Object.prototype.hasOwnProperty.call(body, "address")) {
        data.address = this.normalizeOptionalText(body.address);
      }

      if (body.status !== undefined) {
        data.status = body.status;
      }

      const updatedBranch = await this.prisma.branch.update({
        where: { id: branch.id },
        data,
        select: branchWithCompanySelect,
      });

      return {
        branch: this.toBranchSummary(updatedBranch),
        onboarding: await this.buildBranchOnboarding(updatedBranch),
      };
    } catch (error) {
      this.handleKnownWriteError(
        error,
        "Branch slug must be unique per company",
      );
    }
  }

  async createFloor(branchId: string, body: CreateOnboardingFloorDto) {
    const branch = await this.findBranchWithCompanyOrThrow(
      branchId,
      this.prisma,
    );
    await this.saasService.assertCompanyFeatureEnabled(
      branch.companyId,
      SaasFeatureKey.setup,
    );
    const name = body.name.trim();
    const existingFloor = await this.prisma.floor.findFirst({
      where: { branchId: branch.id, name },
      select: floorSelect,
    });
    const floor =
      existingFloor ??
      (await this.prisma.floor.create({
        data: {
          branchId: branch.id,
          name,
          sortOrder: body.sortOrder ?? 0,
        },
        select: floorSelect,
      }));

    return {
      branch: this.toBranchSummary(branch),
      floor,
      created: !existingFloor,
      onboarding: await this.buildBranchOnboarding(branch),
    };
  }

  async bulkCreateTables(
    branchId: string,
    body: BulkCreateOnboardingTablesDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchWithCompanyOrThrow(branchId, tx);
      await this.saasService.assertCompanyFeatureEnabled(
        branch.companyId,
        SaasFeatureKey.setup,
      );
      const prefix = this.normalizeCode(body.tablePrefix);
      const requestedCodes = Array.from({ length: body.count }, (_, index) => {
        const number = body.startNumber + index;

        return `${prefix}${String(number).padStart(2, "0")}`;
      });
      const existingRequestedTables = await tx.cafeTable.findMany({
        where: { branchId: branch.id, code: { in: requestedCodes } },
        select: tableSelect,
      });
      const existingTableByCode = new Map(
        existingRequestedTables.map((table) => [table.code, table]),
      );
      const newTableCount = requestedCodes.filter(
        (code) => !existingTableByCode.has(code),
      ).length;

      if (newTableCount > 0) {
        await this.saasService.assertWithinLimit(
          branch.companyId,
          "maxTables",
          newTableCount,
        );
      }

      const floorName = body.floorLabel.trim();
      const existingFloor = await tx.floor.findFirst({
        where: { branchId: branch.id, name: floorName },
        select: floorSelect,
      });
      const floor =
        existingFloor ??
        (await tx.floor.create({
          data: {
            branchId: branch.id,
            name: floorName,
            sortOrder: 0,
          },
          select: floorSelect,
        }));
      const created: TableRecord[] = [];
      const skipped: Array<{
        code: string;
        displayName: string;
        reason: string;
        table?: TableRecord;
      }> = [];

      for (const code of requestedCodes) {
        const existingTable = existingTableByCode.get(code);

        if (existingTable) {
          skipped.push({
            code,
            displayName: existingTable.displayName,
            reason: "table_code_exists",
            table: existingTable,
          });
          continue;
        }

        const qrToken = await this.generateAvailableQrToken(branch, code, tx);
        const table = await tx.cafeTable.create({
          data: {
            branchId: branch.id,
            floorId: floor.id,
            code,
            displayName: code,
            capacity: body.seats,
            qrToken,
            status: TableStatus.active,
          },
          select: tableSelect,
        });

        created.push(table);
      }

      return {
        branch: this.toBranchSummary(branch),
        floor,
        created: created.map((table) => this.toTableSummary(table)),
        skipped: skipped.map((entry) => ({
          ...entry,
          table: entry.table ? this.toTableSummary(entry.table) : undefined,
        })),
        requestedCount: body.count,
        createdCount: created.length,
        skippedCount: skipped.length,
        onboarding: await this.buildBranchOnboarding(branch, tx),
      };
    });
  }

  async inviteStaff(
    branchId: string,
    body: InviteOnboardingStaffDto,
    actorStaffUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchWithCompanyOrThrow(branchId, tx);
      await this.saasService.assertCompanyFeatureEnabled(
        branch.companyId,
        SaasFeatureKey.setup,
      );
      const email = body.email.trim().toLowerCase();
      const role = body.role;
      const membershipBranchId = role === StaffRole.owner ? null : branch.id;

      if (role === StaffRole.owner) {
        await this.staffAccessService.assertCan(
          actorStaffUserId,
          "staff.manage",
          {
            companyId: branch.companyId,
          },
        );
      }

      const existingStaffUser = await tx.staffUser.findUnique({
        where: { email },
        select: staffUserSelect,
      });
      const [existingMembership, existingActiveCompanyMembership] =
        existingStaffUser
          ? await Promise.all([
              tx.staffMembership.findFirst({
                where: {
                  staffUserId: existingStaffUser.id,
                  companyId: branch.companyId,
                  branchId: membershipBranchId,
                  role,
                },
                select: staffMembershipSelect,
              }),
              tx.staffMembership.findFirst({
                where: {
                  staffUserId: existingStaffUser.id,
                  companyId: branch.companyId,
                  status: StaffStatus.active,
                },
                select: { id: true },
              }),
            ])
          : [null, null];
      const willCreateCountedStaffUser =
        !existingStaffUser ||
        (!existingActiveCompanyMembership &&
          (!existingMembership ||
            existingMembership.status !== StaffStatus.active));

      if (willCreateCountedStaffUser) {
        await this.saasService.assertWithinLimit(
          branch.companyId,
          "maxStaffUsers",
          1,
          tx,
        );
      }

      const staffUser = existingStaffUser
        ? await tx.staffUser.update({
            where: { id: existingStaffUser.id },
            data: { name: body.name.trim(), status: StaffStatus.active },
            select: staffUserSelect,
          })
        : await tx.staffUser.create({
            data: {
              email,
              name: body.name.trim(),
              status: StaffStatus.active,
            },
            select: staffUserSelect,
          });
      const membership = existingMembership
        ? existingMembership.status === StaffStatus.active
          ? existingMembership
          : await tx.staffMembership.update({
              where: { id: existingMembership.id },
              data: { status: StaffStatus.active },
              select: staffMembershipSelect,
            })
        : await tx.staffMembership.create({
            data: {
              staffUserId: staffUser.id,
              companyId: branch.companyId,
              branchId: membershipBranchId,
              role,
              status: StaffStatus.active,
            },
            select: staffMembershipSelect,
          });
      const invite = await this.staffInvitesService.createStaffInvite(
        {
          companyId: branch.companyId,
          branchId: membershipBranchId,
          staffUserId: staffUser.id,
          email,
          name: staffUser.name,
          role,
          createdByStaffUserId: actorStaffUserId,
          metadata: {
            source: "tenant_onboarding",
            branchId: branch.id,
          },
        },
        tx,
      );

      return {
        staffUser,
        membership,
        createdStaffUser: !existingStaffUser,
        createdMembership: !existingMembership,
        ...invite,
        passwordSetup: {
          required: !staffUser.passwordSetAt,
          nextStep:
            "Send the invite link to the staff user so they can set their password and then log in at /staff/login.",
        },
        onboarding: await this.buildBranchOnboarding(branch, tx),
      };
    });
  }

  async updateReadinessCheck(
    branchId: string,
    body: UpdateReadinessCheckDto,
    actorStaffUserId: string,
  ) {
    const branch = await this.findBranchWithCompanyOrThrow(
      branchId,
      this.prisma,
    );
    const onboarding = await this.buildBranchOnboarding(branch);

    return {
      acknowledged: {
        key: body.key,
        status: body.status,
        note: this.normalizeOptionalText(body.note),
        actorStaffUserId,
        persisted: false,
      },
      message:
        "Readiness is computed from live setup records in Phase 4T.0; manual checklist persistence is reserved for a later workflow phase.",
      onboarding,
    };
  }

  async getLaunchChecklist(branchId: string) {
    const onboarding = await this.getBranchOnboarding(branchId);

    return {
      company: onboarding.company,
      branch: onboarding.branch,
      launchChecklist: onboarding.launchChecklist,
      launchSummary: onboarding.launchSummary,
      generatedAt: onboarding.generatedAt,
    };
  }

  private async buildBranchOnboarding(
    branch: BranchWithCompanyRecord,
    tx: PrismaExecutor = this.prisma,
  ) {
    const [
      floors,
      tables,
      memberships,
      activeCategoryCount,
      menuItems,
      activeModifierGroupCount,
      itemModifierLinkCount,
      printerStationCount,
      activePrinterStationCount,
      operatingSettings,
      featureFlags,
      smartCashierSettings,
      currentOpenShift,
      inventoryItemCount,
      inventoryLevels,
    ] = await Promise.all([
      tx.floor.findMany({
        where: { branchId: branch.id },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: floorSelect,
      }),
      tx.cafeTable.findMany({
        where: { branchId: branch.id },
        orderBy: [{ code: "asc" }],
        select: tableSelect,
      }),
      tx.staffMembership.findMany({
        where: {
          companyId: branch.companyId,
          status: StaffStatus.active,
          OR: [{ branchId: branch.id }, { branchId: null }],
        },
        select: staffMembershipSelect,
      }),
      tx.menuCategory.count({
        where: { companyId: branch.companyId, status: "active" },
      }),
      tx.menuItem.findMany({
        where: {
          companyId: branch.companyId,
          status: { not: MenuItemStatus.archived },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          basePriceMinor: true,
          currency: true,
          modifierGroups: {
            select: { id: true },
          },
          branchOverrides: {
            where: { branchId: branch.id },
            select: {
              id: true,
              isAvailable: true,
              isVisible: true,
              priceOverrideMinor: true,
            },
          },
        },
      }),
      tx.modifierGroup.count({
        where: {
          companyId: branch.companyId,
          status: ModifierGroupStatus.active,
        },
      }),
      tx.menuItemModifierGroup.count({
        where: {
          menuItem: {
            companyId: branch.companyId,
            status: MenuItemStatus.active,
          },
          modifierGroup: {
            status: ModifierGroupStatus.active,
          },
        },
      }),
      tx.printerStation.count({ where: { branchId: branch.id } }),
      tx.printerStation.count({
        where: { branchId: branch.id, status: "active" },
      }),
      tx.branchOperatingSettings.findUnique({
        where: { branchId: branch.id },
        select: {
          operatingMode: true,
          serviceMode: true,
          aiWaiterEnabled: true,
          billFlowEnabled: true,
          analyticsEnabled: true,
        },
      }),
      tx.branchFeatureFlag.findMany({
        where: { branchId: branch.id },
        select: { key: true, enabled: true },
      }),
      tx.branchSmartCashierSettings.findUnique({
        where: { branchId: branch.id },
        select: { mode: true, enabled: true },
      }),
      tx.cashierShift.findFirst({
        where: { branchId: branch.id, status: "open" },
        orderBy: [{ openedAt: "desc" }],
        select: { id: true, status: true, openedAt: true },
      }),
      tx.inventoryItem.count({
        where: {
          companyId: branch.companyId,
          status: InventoryItemStatus.active,
        },
      }),
      tx.branchInventoryLevel.findMany({
        where: { branchId: branch.id },
        select: {
          id: true,
          quantityOnHand: true,
          lowStockThresholdQuantity: true,
          inventoryItem: {
            select: {
              id: true,
              status: true,
              lowStockThresholdQuantity: true,
            },
          },
        },
      }),
    ]);
    const roleCounts = this.countRoles(memberships);
    const activeTables = tables.filter(
      (table) => table.status === TableStatus.active,
    );
    const qrReadyTables = activeTables.filter((table) =>
      this.hasQrToken(table.qrToken),
    );
    const activeMenuItems = menuItems.filter(
      (item) => item.status === MenuItemStatus.active,
    );
    const availableMenuItems = activeMenuItems.filter((item) =>
      item.branchOverrides.some(
        (override) => override.isAvailable && override.isVisible,
      ),
    );
    const itemsWithModifiers = activeMenuItems.filter(
      (item) => item.modifierGroups.length > 0,
    );
    const missingPriceItems = activeMenuItems.filter(
      (item) => item.basePriceMinor <= 0,
    );
    const branchOverrideCount = menuItems.reduce(
      (sum, item) => sum + item.branchOverrides.length,
      0,
    );
    const activeInventoryLevels = inventoryLevels.filter(
      (level) => level.inventoryItem.status === InventoryItemStatus.active,
    );
    const outOfStockInventoryCount = activeInventoryLevels.filter(
      (level) => level.quantityOnHand <= 0,
    ).length;
    const lowStockInventoryCount = activeInventoryLevels.filter((level) => {
      const threshold =
        level.lowStockThresholdQuantity ??
        level.inventoryItem.lowStockThresholdQuantity;

      return (
        threshold !== null &&
        threshold !== undefined &&
        level.quantityOnHand > 0 &&
        level.quantityOnHand <= threshold
      );
    }).length;
    const featureFlagMap = Object.fromEntries(
      featureFlags.map((flag) => [flag.key, flag.enabled]),
    );
    const onlinePaymentsEnabled =
      this.configService.get<boolean>("onlinePayments.enabled") !== false;
    const onlinePaymentProvider =
      this.configService.get<string>("onlinePayments.provider") ?? "mock";
    const mockOnlinePaymentsEnabled =
      this.configService.get<boolean>("onlinePayments.mockEnabled") !== false;
    const onlinePaymentProviderIsMock =
      onlinePaymentsEnabled && onlinePaymentProvider === "mock";
    const saasStatus = await this.saasService.getCompanySaasStatus(
      branch.companyId,
    );
    const saasItems = [
      this.item(
        "saas_subscription_active",
        "Plan subscription active",
        Boolean(saasStatus.subscription) && saasStatus.blockers.length === 0,
        saasStatus.subscription
          ? saasStatus.blockers.length === 0
            ? `${saasStatus.plan?.name ?? "Current"} plan is ${saasStatus.subscription.status}.`
            : saasStatus.blockers[0]?.message ??
              "Subscription has a blocking status."
          : "Assign a SaaS plan before launch setup can be fully tracked.",
        "/staff/billing",
        {
          planCode: saasStatus.plan?.code ?? null,
          subscriptionStatus: saasStatus.subscription?.status ?? "unconfigured",
          warnings: saasStatus.warnings,
          blockers: saasStatus.blockers,
        },
        saasStatus.blockers.length > 0 ? "blocked" : "needs_attention",
      ),
      this.item(
        "saas_setup_enabled",
        "Setup entitlement enabled",
        saasStatus.entitlements.setup,
        saasStatus.entitlements.setup
          ? "Current plan includes tenant setup tools."
          : "Setup tools are not enabled on the current plan.",
        "/staff/billing",
        { entitlements: saasStatus.entitlements },
        "blocked",
      ),
      this.item(
        "saas_limits_within_plan",
        "Usage within plan limits",
        saasStatus.blockers.every((blocker) => !blocker.metricKey),
        saasStatus.blockers.some((blocker) => blocker.metricKey)
          ? "One or more usage metrics exceeds the current plan limit."
          : saasStatus.warnings.some((warning) => warning.metricKey)
            ? "One or more usage metrics is close to the current plan limit."
            : "Current setup usage is within plan limits.",
        "/staff/billing",
        { usage: saasStatus.usage, limits: saasStatus.limits },
        saasStatus.blockers.some((blocker) => blocker.metricKey)
          ? "blocked"
          : "needs_attention",
      ),
    ];
    const companyProfileItems = this.getCompanyProfileItems(branch.company);
    const branchProfileItems = this.getBranchProfileItems(branch);
    const tablesItems = [
      this.item(
        "floors_created",
        "Floors or areas created",
        floors.length > 0,
        floors.length > 0
          ? `${floors.length} floor or area record${floors.length === 1 ? "" : "s"} ready.`
          : "Create at least one floor or service area.",
        "/staff/setup",
        { floorCount: floors.length },
      ),
      this.item(
        "tables_created",
        "Active tables created",
        activeTables.length > 0,
        activeTables.length > 0
          ? `${activeTables.length} active table${activeTables.length === 1 ? "" : "s"} ready.`
          : "Create active tables before customer QR launch.",
        "/staff/setup",
        { activeTableCount: activeTables.length, tableCount: tables.length },
      ),
      this.item(
        "qr_links_ready",
        "QR links ready",
        activeTables.length > 0 && qrReadyTables.length === activeTables.length,
        activeTables.length > 0 && qrReadyTables.length === activeTables.length
          ? "Every active table has a QR token."
          : `${Math.max(activeTables.length - qrReadyTables.length, 0)} active table${activeTables.length - qrReadyTables.length === 1 ? "" : "s"} still need QR tokens.`,
        "/staff/branches",
        {
          activeTableCount: activeTables.length,
          qrReadyTableCount: qrReadyTables.length,
        },
      ),
    ];
    const staffItems = [
      this.roleItem(
        "owner_staff_ready",
        "Owner or manager ready",
        ["owner", "branch_manager"],
        roleCounts,
        "/staff/setup",
      ),
      this.roleItem(
        "cashier_staff_ready",
        "Cashier ready",
        ["cashier"],
        roleCounts,
      ),
      this.roleItem(
        "kitchen_staff_ready",
        "Kitchen or barista ready",
        ["kitchen", "barista"],
        roleCounts,
      ),
      this.roleItem(
        "waiter_staff_ready",
        "Waiter ready",
        ["waiter"],
        roleCounts,
      ),
    ];
    const menuItemsReadiness = [
      this.item(
        "menu_categories_ready",
        "Menu categories ready",
        activeCategoryCount > 0,
        activeCategoryCount > 0
          ? `${activeCategoryCount} active categor${activeCategoryCount === 1 ? "y" : "ies"} ready.`
          : "Add active menu categories.",
        "/staff/menu",
        { activeCategoryCount },
      ),
      this.item(
        "menu_items_ready",
        "Active menu items ready",
        activeMenuItems.length > 0 && availableMenuItems.length > 0,
        activeMenuItems.length > 0 && availableMenuItems.length > 0
          ? `${availableMenuItems.length} branch-available item${availableMenuItems.length === 1 ? "" : "s"} from ${activeMenuItems.length} active item${activeMenuItems.length === 1 ? "" : "s"}.`
          : "Add active menu items and branch availability before customer ordering.",
        "/staff/menu",
        {
          activeItemCount: activeMenuItems.length,
          availableItemCount: availableMenuItems.length,
        },
      ),
      this.item(
        "modifiers_ready",
        "Modifier structure checked",
        activeModifierGroupCount > 0 && itemModifierLinkCount > 0,
        activeModifierGroupCount > 0 && itemModifierLinkCount > 0
          ? `${activeModifierGroupCount} active modifier group${activeModifierGroupCount === 1 ? "" : "s"} linked to menu items.`
          : "No active modifiers are linked yet. Simple menus can launch, but modifier-heavy cafes should finish this.",
        "/staff/menu",
        {
          activeModifierGroupCount,
          itemModifierLinkCount,
          itemsWithModifiers: itemsWithModifiers.length,
        },
        activeModifierGroupCount > 0 && itemModifierLinkCount > 0
          ? undefined
          : "needs_attention",
      ),
      this.item(
        "ai_waiter_menu_grounding_ready",
        "AI waiter menu grounding ready",
        availableMenuItems.length >= 3 && missingPriceItems.length === 0,
        availableMenuItems.length >= 3 && missingPriceItems.length === 0
          ? "The branch menu has enough priced available items for grounded suggestions."
          : "AI waiter suggestions need at least three priced branch-available items.",
        "/staff/menu",
        {
          availableItemCount: availableMenuItems.length,
          missingPriceItemCount: missingPriceItems.length,
        },
        availableMenuItems.length >= 3 && missingPriceItems.length === 0
          ? undefined
          : "needs_attention",
      ),
      this.item(
        "inventory_foundation_ready",
        "Inventory foundation ready",
        inventoryItemCount > 0 && activeInventoryLevels.length > 0,
        inventoryItemCount > 0 && activeInventoryLevels.length > 0
          ? `${inventoryItemCount} active inventory item${inventoryItemCount === 1 ? "" : "s"} and ${activeInventoryLevels.length} branch stock level${activeInventoryLevels.length === 1 ? "" : "s"} ready.`
          : "Add inventory items and opening branch stock before pilot operations.",
        "/staff/inventory",
        {
          inventoryItemCount,
          trackedLevelCount: activeInventoryLevels.length,
          lowStockCount: lowStockInventoryCount,
          outOfStockCount: outOfStockInventoryCount,
        },
        inventoryItemCount > 0 && activeInventoryLevels.length > 0
          ? undefined
          : "needs_attention",
      ),
    ];
    const operationsItems = [
      this.item(
        "cashier_shift_ready",
        "Cashier shift can open",
        (roleCounts.cashier ?? 0) > 0 && activeTables.length > 0,
        (roleCounts.cashier ?? 0) > 0 && activeTables.length > 0
          ? currentOpenShift
            ? "A cashier shift is already open."
            : "Cashier role and active tables are ready; a shift can be opened at service start."
          : "Cashier shifts need cashier staff and active tables.",
        "/staff/cashier",
        { currentOpenShift },
      ),
      this.item(
        "printer_foundation_ready",
        "Printer software routing ready",
        activePrinterStationCount > 0,
        activePrinterStationCount > 0
          ? `${activePrinterStationCount} active printer station record${activePrinterStationCount === 1 ? "" : "s"} configured for software routing. Physical transport is not verified by Setup.`
          : "No active printer station is configured yet. Configure software routing before venue hardware verification.",
        "/staff/kitchen",
        {
          printerStationCount,
          activePrinterStationCount,
          physicalTransportVerified: false,
        },
        activePrinterStationCount > 0 ? undefined : "needs_attention",
      ),
      this.item(
        "physical_printer_hardware_ready",
        "Physical printer installation verified",
        false,
        activePrinterStationCount > 0
          ? "Software routing exists, but printer transport, cabling, and on-site device success require venue verification."
          : "Configure printer software routing first, then verify the physical printer on site.",
        "/staff/kitchen",
        {
          externalGate: true,
          printerStationCount,
          activePrinterStationCount,
          physicalTransportVerified: false,
        },
        "needs_attention",
      ),
      this.item(
        "bills_payment_ready",
        "Bill and manual payment flow ready",
        (roleCounts.cashier ?? 0) > 0 &&
          Boolean(featureFlagMap.bill_flow ?? true),
        (roleCounts.cashier ?? 0) > 0
          ? "Bill presentation and manual payment are enabled through cashier operations."
          : "Add cashier staff before bill/payment handoff is ready.",
        "/staff/cashier",
        { billFlowEnabled: featureFlagMap.bill_flow ?? true },
      ),
      this.item(
        "online_payment_provider_ready",
        "Live online payment certification",
        false,
        !onlinePaymentsEnabled
          ? "Online payments are disabled. Manual payment can remain the launch path unless hosted checkout is required."
          : onlinePaymentProviderIsMock
            ? "Mock checkout is not live merchant readiness. Configure and externally certify a production provider before hosted payment go-live."
            : `${onlinePaymentProvider} is configured in software, but merchant/provider certification is an external go-live gate that Setup cannot assert.`,
        "/staff/cashier",
        {
          onlinePaymentsEnabled,
          onlinePaymentProvider,
          mockOnlinePaymentsEnabled,
          providerConfiguredBeyondMock:
            onlinePaymentsEnabled && !onlinePaymentProviderIsMock,
          externalCertificationVerified: false,
        },
        onlinePaymentsEnabled ? "blocked" : "needs_attention",
      ),
      this.item(
        "kds_ready",
        "KDS ticket system ready",
        (roleCounts.kitchen ?? 0) + (roleCounts.barista ?? 0) > 0,
        (roleCounts.kitchen ?? 0) + (roleCounts.barista ?? 0) > 0
          ? "Kitchen or barista staff can work preparation tasks and tickets."
          : "Add kitchen or barista staff before station operations launch.",
        "/staff/kitchen",
      ),
      this.item(
        "analytics_ready",
        "Owner analytics access ready",
        (roleCounts.owner ?? 0) + (roleCounts.branch_manager ?? 0) > 0,
        (roleCounts.owner ?? 0) + (roleCounts.branch_manager ?? 0) > 0
          ? "Owner-level analytics access exists for this branch."
          : "Add an owner or branch manager before analytics can be reviewed.",
        "/staff/owner",
      ),
    ];
    const launchChecklist = [
      ...companyProfileItems,
      ...branchProfileItems,
      ...tablesItems,
      ...staffItems,
      ...menuItemsReadiness,
      ...saasItems,
      ...operationsItems,
    ];
    const sections = [
      this.section("company_profile", "Company profile", companyProfileItems),
      this.section("branch_profile", "Branch profile", branchProfileItems),
      this.section("tables_qr", "Tables and QR", tablesItems),
      this.section("staff_setup", "Staff setup", staffItems),
      this.section("menu_readiness", "Menu readiness", menuItemsReadiness),
      this.section("saas_plan", "Plan and limits", saasItems),
      this.section(
        "operations_readiness",
        "Operations readiness",
        operationsItems,
      ),
    ];

    return {
      company: branch.company,
      branch: this.toBranchSummary(branch),
      generatedAt: new Date().toISOString(),
      sections,
      tables: {
        floorCount: floors.length,
        tableCount: tables.length,
        activeTableCount: activeTables.length,
        qrReadyTableCount: qrReadyTables.length,
        missingQrTableCount: Math.max(
          activeTables.length - qrReadyTables.length,
          0,
        ),
        floors,
        recentTables: tables
          .slice(0, 12)
          .map((table) => this.toTableSummary(table)),
      },
      staff: {
        total: memberships.length,
        roleCounts,
        staff: memberships.map((membership) => ({
          membership: {
            id: membership.id,
            companyId: membership.companyId,
            branchId: membership.branchId,
            role: membership.role,
            status: membership.status,
          },
          staffUser: membership.staffUser,
        })),
      },
      menu: {
        activeCategoryCount,
        totalItemCount: menuItems.length,
        activeItemCount: activeMenuItems.length,
        availableItemCount: availableMenuItems.length,
        branchOverrideCount,
        activeModifierGroupCount,
        itemModifierLinkCount,
        itemsWithModifiersCount: itemsWithModifiers.length,
        missingPriceItemCount: missingPriceItems.length,
        aiWaiterMenuGroundingReady:
          availableMenuItems.length >= 3 && missingPriceItems.length === 0,
        inventoryItemCount,
        trackedInventoryLevelCount: activeInventoryLevels.length,
        lowStockCount: lowStockInventoryCount,
        outOfStockCount: outOfStockInventoryCount,
      },
      operations: {
        operatingSettings,
        smartCashierSettings,
        featureFlags: featureFlagMap,
        printerStationCount,
        activePrinterStationCount,
        currentOpenShift,
        cashierShiftCanOpen:
          (roleCounts.cashier ?? 0) > 0 && activeTables.length > 0,
      },
      saas: saasStatus,
      launchChecklist,
      launchSummary: this.launchSummary(launchChecklist),
    };
  }

  private getCompanyProfileItems(company: CompanyRecord): ChecklistItem[] {
    return [
      this.item(
        "company_profile",
        "Company profile complete",
        Boolean(company.name?.trim()) &&
          Boolean(company.slug?.trim()) &&
          company.status === CompanyStatus.active,
        company.status === CompanyStatus.active
          ? "Company name, slug, and active status are set."
          : "Company must be active with a usable name and slug.",
        "/staff/setup",
        { status: company.status },
      ),
    ];
  }

  private getBranchProfileItems(branch: BranchRecord): ChecklistItem[] {
    return [
      this.item(
        "branch_profile",
        "Branch profile complete",
        Boolean(branch.name?.trim()) &&
          Boolean(branch.slug?.trim()) &&
          Boolean(branch.address?.trim()) &&
          branch.status === BranchStatus.active,
        branch.status === BranchStatus.active && Boolean(branch.address?.trim())
          ? "Branch name, slug, address, and active status are set."
          : "Branch should be active and include name, slug, and address before launch.",
        "/staff/setup",
        { status: branch.status, hasAddress: Boolean(branch.address?.trim()) },
      ),
    ];
  }

  private item(
    key: string,
    label: string,
    ready: boolean,
    reason: string,
    actionHref?: string,
    metadata?: Record<string, unknown>,
    fallbackStatus: ReadinessStatus = "missing",
  ): ChecklistItem {
    return {
      key,
      label,
      status: ready ? "ready" : fallbackStatus,
      reason,
      actionHref,
      metadata,
    };
  }

  private roleItem(
    key: string,
    label: string,
    roles: Array<keyof ReturnType<TenantOnboardingService["countRoles"]>>,
    roleCounts: ReturnType<TenantOnboardingService["countRoles"]>,
    actionHref = "/staff/setup",
  ): ChecklistItem {
    const count = roles.reduce((sum, role) => sum + (roleCounts[role] ?? 0), 0);

    return this.item(
      key,
      label,
      count > 0,
      count > 0
        ? `${count} matching staff assignment${count === 1 ? "" : "s"} found.`
        : `Add ${roles.join(" or ")} staff before launch.`,
      actionHref,
      { roles, count },
    );
  }

  private section(
    key: string,
    label: string,
    items: ChecklistItem[],
  ): ReadinessSection {
    const readyCount = items.filter((item) => item.status === "ready").length;
    const totalCount = items.length;
    const percentage =
      totalCount === 0 ? 0 : Math.round((readyCount / totalCount) * 100);
    const status = items.some((item) => item.status === "blocked")
      ? "blocked"
      : readyCount === totalCount
        ? "ready"
        : items.some((item) => item.status === "needs_attention")
          ? "needs_attention"
          : "missing";

    return {
      key,
      label,
      status,
      readyCount,
      totalCount,
      percentage,
      items,
    };
  }

  private launchSummary(items: ChecklistItem[]) {
    const criticalItems = items.filter((item) =>
      criticalLaunchKeys.has(item.key),
    );
    const missingCritical = criticalItems.filter(
      (item) => item.status !== "ready",
    );
    const printerReady = items.some(
      (item) =>
        item.key === "printer_foundation_ready" && item.status === "ready",
    );
    const modifiersReady = items.some(
      (item) => item.key === "modifiers_ready" && item.status === "ready",
    );
    const readyForDemo = missingCritical.length === 0;
    const readyForPilot = readyForDemo && printerReady && modifiersReady;

    return {
      status: readyForPilot
        ? "ready_for_pilot"
        : readyForDemo
          ? "ready_for_demo"
          : "blocked",
      readyForDemo,
      readyForPilot,
      blockedReasons: missingCritical.map((item) => ({
        key: item.key,
        label: item.label,
        reason: item.reason,
      })),
      missingCriticalCount: missingCritical.length,
      totalCriticalCount: criticalItems.length,
    };
  }

  private countRoles(memberships: StaffMembershipRecord[]) {
    const counts: Record<StaffRole, number> = {
      [StaffRole.owner]: 0,
      [StaffRole.branch_manager]: 0,
      [StaffRole.cashier]: 0,
      [StaffRole.waiter]: 0,
      [StaffRole.kitchen]: 0,
      [StaffRole.barista]: 0,
      [StaffRole.menu_admin]: 0,
    };

    for (const membership of memberships) {
      counts[membership.role] += 1;
    }

    return counts;
  }

  private toBranchSummary(branch: BranchRecord) {
    return {
      id: branch.id,
      companyId: branch.companyId,
      name: branch.name,
      slug: branch.slug,
      address: branch.address,
      status: branch.status,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }

  private toTableSummary(table: TableRecord) {
    return {
      id: table.id,
      branchId: table.branchId,
      floorId: table.floorId,
      code: table.code,
      displayName: table.displayName,
      capacity: table.capacity,
      qrToken: table.qrToken,
      status: table.status,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
      floor: table.floor,
      customerPreviewPath: table.qrToken
        ? `/customer/table/${encodeURIComponent(table.qrToken)}`
        : null,
    };
  }

  private async generateAvailableQrToken(
    branch: BranchRecord,
    tableCode: string,
    tx: PrismaExecutor,
  ) {
    const baseToken = this.normalizeQrToken(
      `${branch.slug}-${this.normalizeCode(tableCode).toLowerCase()}`,
    );

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate =
        attempt === 0 ? baseToken : `${baseToken}-${attempt + 1}`;
      const existing = await tx.cafeTable.findUnique({
        where: { qrToken: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new BadRequestException("Could not generate a unique QR token");
  }

  private normalizeQrToken(value: string) {
    const qrToken = value.trim().toLowerCase();

    if (!qrTokenPattern.test(qrToken)) {
      throw new BadRequestException(
        "QR token must use lowercase letters, numbers, and hyphens",
      );
    }

    return qrToken;
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, "");
  }

  private hasQrToken(value?: string | null) {
    return Boolean(value?.trim());
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : null;
  }

  private async findCompanyOrThrow(companyId: string, tx: PrismaExecutor) {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: companySelect,
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return company;
  }

  private async findBranchOrThrow(branchId: string, tx: PrismaExecutor) {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: branchSelect,
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    return branch;
  }

  private async findBranchWithCompanyOrThrow(
    branchId: string,
    tx: PrismaExecutor,
  ) {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: branchWithCompanySelect,
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    return branch;
  }

  private handleKnownWriteError(error: unknown, uniqueMessage: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BadRequestException(uniqueMessage);
    }

    throw error;
  }
}
