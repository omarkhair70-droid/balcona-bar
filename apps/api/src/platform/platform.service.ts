import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BranchStatus,
  CompanyStatus,
  CompanySubscriptionStatus,
  Prisma,
  SaasPlanStatus,
  StaffRole,
  StaffStatus,
  TableStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SaasService } from "../saas/saas.service";
import { CreateStaffInviteDto } from "../staff-invites/dto/create-staff-invite.dto";
import { StaffInvitesService } from "../staff-invites/staff-invites.service";
import { BootstrapPlatformCompanyDto } from "./dto/bootstrap-platform-company.dto";
import { UpdatePlatformSubscriptionDto } from "./dto/update-platform-subscription.dto";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const bootstrapCompanyTransactionOptions = {
  maxWait: 10_000,
  timeout: 30_000,
};
const qrTokenPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  floor: { select: floorSelect },
} satisfies Prisma.CafeTableSelect;

const staffUserSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  passwordSetAt: true,
  lastLoginAt: true,
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
  staffUser: { select: staffUserSelect },
} satisfies Prisma.StaffMembershipSelect;

const staffInviteSummarySelect = {
  id: true,
  companyId: true,
  branchId: true,
  staffUserId: true,
  email: true,
  name: true,
  role: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffInviteSelect;

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

type BranchRecord = Prisma.BranchGetPayload<{ select: typeof branchSelect }>;
type TableRecord = Prisma.CafeTableGetPayload<{ select: typeof tableSelect }>;

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly saasService: SaasService,
    private readonly staffInvitesService: StaffInvitesService,
  ) {}

  async getPlans() {
    const plans = await this.prisma.saasPlan.findMany({
      where: { status: { not: SaasPlanStatus.archived } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: planSelect,
    });

    return { plans };
  }

  async listCompanies() {
    const companies = await this.prisma.company.findMany({
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      select: {
        ...companySelect,
        saasSubscription: { select: subscriptionSelect },
        _count: {
          select: {
            branches: true,
            staffMemberships: true,
          },
        },
      },
    });
    const summaries = companies.map((company) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      subscription: company.saasSubscription,
      branchCount: company._count.branches,
      staffMembershipCount: company._count.staffMemberships,
    }));

    return {
      companies: summaries,
      summary: {
        totalCompanies: summaries.length,
        activeSubscriptions: summaries.filter(
          (company) => company.subscription?.status === "active",
        ).length,
        trialingSubscriptions: summaries.filter(
          (company) => company.subscription?.status === "trialing",
        ).length,
        suspendedSubscriptions: summaries.filter(
          (company) => company.subscription?.status === "suspended",
        ).length,
      },
    };
  }

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        ...companySelect,
        saasSubscription: { select: subscriptionSelect },
        branches: {
          orderBy: [{ name: "asc" }, { id: "asc" }],
          select: {
            ...branchSelect,
            _count: {
              select: {
                floors: true,
                tables: true,
              },
            },
          },
        },
        staffMemberships: {
          where: {
            status: StaffStatus.active,
            role: { in: [StaffRole.owner, StaffRole.branch_manager] },
          },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          select: staffMembershipSelect,
        },
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const latestInviteByStaffUserId = await this.getLatestInviteByStaffUserId(
      company.id,
      company.staffMemberships.map((membership) => membership.staffUserId),
    );
    const [saas, auditEvents] = await Promise.all([
      this.saasService.getCompanySaasStatus(company.id),
      this.prisma.platformAuditEvent.findMany({
        where: {
          targetType: "company",
          targetId: company.id,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 12,
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          metadata: true,
          createdAt: true,
          platformAdminUser: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        status: company.status,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      },
      subscription: company.saasSubscription,
      plan: company.saasSubscription?.plan ?? null,
      branches: company.branches.map((branch) => ({
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
      owners: company.staffMemberships.map((membership) => ({
        ...membership,
        recentInvite:
          latestInviteByStaffUserId.get(membership.staffUserId) ?? null,
      })),
      saas,
      auditEvents,
    };
  }

  async createCompanyStaffInvite(
    companyId: string,
    body: CreateStaffInviteDto,
    platformAdminUserId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: companySelect,
        });

        if (!company) {
          throw new NotFoundException("Company not found");
        }

        const email = body.email.trim().toLowerCase();
        const role = body.role;
        const membershipBranchId =
          role === StaffRole.owner ? null : (body.branchId ?? null);

        if (role !== StaffRole.owner && !membershipBranchId) {
          throw new BadRequestException("Branch is required for this staff role");
        }

        const branch = membershipBranchId
          ? await tx.branch.findUnique({
              where: { id: membershipBranchId },
              select: branchSelect,
            })
          : null;

        if (membershipBranchId && branch?.companyId !== company.id) {
          throw new BadRequestException("Branch must belong to this company");
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
                    companyId: company.id,
                    branchId: membershipBranchId,
                    role,
                  },
                  select: staffMembershipSelect,
                }),
                tx.staffMembership.findFirst({
                  where: {
                    staffUserId: existingStaffUser.id,
                    companyId: company.id,
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
            company.id,
            "maxStaffUsers",
            1,
            tx,
          );
        }

        const staffUser = existingStaffUser
          ? await tx.staffUser.update({
              where: { id: existingStaffUser.id },
              data: {
                name: body.name.trim(),
                status: StaffStatus.active,
              },
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
                companyId: company.id,
                branchId: membershipBranchId,
                role,
                status: StaffStatus.active,
              },
              select: staffMembershipSelect,
            });
        const invite = await this.staffInvitesService.createStaffInvite(
          {
            companyId: company.id,
            branchId: membershipBranchId,
            staffUserId: staffUser.id,
            email,
            name: staffUser.name,
            role,
            createdByPlatformAdminId: platformAdminUserId,
            metadata: {
              source: "platform_company_detail",
            },
          },
          tx,
        );

        return {
          company,
          branch,
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
        };
      },
      bootstrapCompanyTransactionOptions,
    );
  }

  async bootstrapCompany(
    body: BootstrapPlatformCompanyDto,
    platformAdminUserId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const companySlug = this.normalizeSlug(body.company.slug);
        const branchSlug = this.normalizeSlug(body.branch.slug);
        const ownerEmail = body.owner.email.trim().toLowerCase();
        const existingCompany = await tx.company.findUnique({
          where: { slug: companySlug },
          select: { id: true },
        });

        if (existingCompany) {
          throw new BadRequestException("Company slug already exists");
        }

        const plan = await tx.saasPlan.findUnique({
          where: { code: body.subscription.planCode },
          select: planSelect,
        });

        if (!plan || plan.status !== SaasPlanStatus.active) {
          throw new BadRequestException("Active SaaS plan not found");
        }

        const company = await tx.company.create({
          data: {
            name: body.company.name.trim(),
            slug: companySlug,
            status: CompanyStatus.active,
          },
          select: companySelect,
        });

        const subscription = await tx.companySubscription.create({
          data: {
            companyId: company.id,
            planId: plan.id,
            status:
              body.subscription.status ?? CompanySubscriptionStatus.trialing,
            currentPeriodStart: new Date(),
            metadata: {
              source: "platform_bootstrap",
              platformAdminUserId,
            },
          },
          select: subscriptionSelect,
        });

        await this.saasService.assertWithinLimit(
          company.id,
          "maxBranches",
          1,
          tx,
        );

        const branch = await tx.branch.create({
          data: {
            companyId: company.id,
            name: body.branch.name.trim(),
            slug: branchSlug,
            address: this.normalizeOptionalText(body.branch.address),
            status: BranchStatus.active,
          },
          select: branchSelect,
        });

        const existingStaffUser = await tx.staffUser.findUnique({
          where: { email: ownerEmail },
          select: staffUserSelect,
        });
        const existingActiveCompanyMembership = existingStaffUser
          ? await tx.staffMembership.findFirst({
              where: {
                staffUserId: existingStaffUser.id,
                companyId: company.id,
                status: StaffStatus.active,
              },
              select: { id: true },
            })
          : null;
        const willCreateCountedOwner =
          !existingStaffUser || !existingActiveCompanyMembership;

        if (willCreateCountedOwner) {
          await this.saasService.assertWithinLimit(
            company.id,
            "maxStaffUsers",
            1,
            tx,
          );
        }

        const staffUser = existingStaffUser
          ? await tx.staffUser.update({
              where: { id: existingStaffUser.id },
              data: {
                name: body.owner.name.trim(),
                status: StaffStatus.active,
              },
              select: staffUserSelect,
            })
          : await tx.staffUser.create({
              data: {
                email: ownerEmail,
                name: body.owner.name.trim(),
                status: StaffStatus.active,
              },
              select: staffUserSelect,
            });
        const existingOwnerMembership = await tx.staffMembership.findFirst({
          where: {
            staffUserId: staffUser.id,
            companyId: company.id,
            branchId: null,
            role: StaffRole.owner,
          },
          select: staffMembershipSelect,
        });
        const ownerMembership =
          existingOwnerMembership ??
          (await tx.staffMembership.create({
            data: {
              staffUserId: staffUser.id,
              companyId: company.id,
              branchId: null,
              role: StaffRole.owner,
              status: StaffStatus.active,
            },
            select: staffMembershipSelect,
          }));
        const starterTables = body.starterTables?.enabled
          ? await this.createStarterTables(company.id, branch, body, tx)
          : null;

        await tx.platformAuditEvent.create({
          data: {
            platformAdminUserId,
            action: "company_bootstrapped",
            targetType: "company",
            targetId: company.id,
            metadata: {
              companySlug,
              branchId: branch.id,
              branchSlug,
              planCode: plan.code,
              ownerStaffUserId: staffUser.id,
              starterTableCount: starterTables?.createdCount ?? 0,
            },
          },
        });

        const qrExamples =
          starterTables?.created.slice(0, 3).map((table) => ({
            tableId: table.id,
            code: table.code,
            qrToken: table.qrToken,
            customerUrl: `/customer/table/${encodeURIComponent(table.qrToken)}`,
          })) ?? [];

        return {
          company,
          branch,
          subscription,
          plan,
          ownerStaffUser: staffUser,
          ownerMembership,
          starterTables,
          companyId: company.id,
          branchId: branch.id,
          ownerStaffUserId: staffUser.id,
          setupUrl: "/staff/setup",
          billingUrl: "/staff/billing",
          staffLoginUrl: "/staff/login",
          customerQrExamples: qrExamples,
          passwordSetup: {
            ownerEmail,
            passwordAlreadySet: Boolean(staffUser.passwordSetAt),
            devBootstrapAvailable: this.configService.get<boolean>(
              "staffAuth.devBootstrapEnabled",
              false,
            ),
            instructions:
              "Set the owner password through the secure staff auth flow. Local dev may use /api/v1/staff-auth/dev/bootstrap-password only when explicitly enabled.",
          },
        };
      },
      bootstrapCompanyTransactionOptions,
    );
  }

  async updateCompanySubscription(
    companyId: string,
    body: UpdatePlatformSubscriptionDto,
    platformAdminUserId: string,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: companySelect,
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const currentSubscription =
      await this.prisma.companySubscription.findUnique({
        where: { companyId: company.id },
        select: subscriptionSelect,
      });
    const plan = body.planCode
      ? await this.prisma.saasPlan.findUnique({
          where: { code: body.planCode },
          select: planSelect,
        })
      : currentSubscription?.plan;

    if (!plan || plan.status !== SaasPlanStatus.active) {
      throw new BadRequestException("Active SaaS plan not found");
    }

    const status = body.status ?? currentSubscription?.status ?? "trialing";
    const subscription = await this.prisma.companySubscription.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        planId: plan.id,
        status,
        currentPeriodStart: new Date(),
        cancellationReason: this.normalizeOptionalText(
          body.cancellationReason,
        ),
        metadata: {
          source: "platform_subscription_update",
          platformAdminUserId,
        },
      },
      update: {
        planId: plan.id,
        status,
        cancellationReason: this.normalizeOptionalText(
          body.cancellationReason,
        ),
        metadata: {
          source: "platform_subscription_update",
          platformAdminUserId,
        },
      },
      select: subscriptionSelect,
    });

    await this.prisma.platformAuditEvent.create({
      data: {
        platformAdminUserId,
        action: "company_subscription_updated",
        targetType: "company",
        targetId: company.id,
        metadata: {
          planCode: plan.code,
          status,
        },
      },
    });

    return {
      company,
      subscription,
      plan: subscription.plan,
      saas: await this.saasService.getCompanySaasStatus(company.id),
    };
  }

  private async createStarterTables(
    companyId: string,
    branch: BranchRecord,
    body: BootstrapPlatformCompanyDto,
    tx: PrismaExecutor,
  ) {
    const starterTables = body.starterTables;

    if (!starterTables) {
      return null;
    }

    const prefix = this.normalizeCode(starterTables.tablePrefix);
    const requestedCodes = Array.from(
      { length: starterTables.count },
      (_, index) => {
        const number = starterTables.startNumber + index;

        return `${prefix}${String(number).padStart(2, "0")}`;
      },
    );
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
        companyId,
        "maxTables",
        newTableCount,
        tx,
      );
    }

    const floorName = starterTables.floorLabel.trim();
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
          capacity: starterTables.seats,
          qrToken,
          status: TableStatus.active,
        },
        select: tableSelect,
      });

      created.push(table);
    }

    return {
      floor,
      created: created.map((table) => this.toTableSummary(table)),
      skipped: skipped.map((entry) => ({
        ...entry,
        table: entry.table ? this.toTableSummary(entry.table) : undefined,
      })),
      requestedCount: starterTables.count,
      createdCount: created.length,
      skippedCount: skipped.length,
    };
  }

  private async getLatestInviteByStaffUserId(
    companyId: string,
    staffUserIds: string[],
  ) {
    if (staffUserIds.length === 0) {
      return new Map<string, Prisma.StaffInviteGetPayload<{
        select: typeof staffInviteSummarySelect;
      }>>();
    }

    const invites = await this.prisma.staffInvite.findMany({
      where: {
        companyId,
        staffUserId: { in: staffUserIds },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: staffInviteSummarySelect,
    });
    const latestInviteByStaffUserId = new Map<
      string,
      Prisma.StaffInviteGetPayload<{ select: typeof staffInviteSummarySelect }>
    >();

    for (const invite of invites) {
      if (invite.staffUserId && !latestInviteByStaffUserId.has(invite.staffUserId)) {
        latestInviteByStaffUserId.set(invite.staffUserId, invite);
      }
    }

    return latestInviteByStaffUserId;
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
      customerPreviewPath: `/customer/table/${encodeURIComponent(table.qrToken)}`,
    };
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeSlug(value: string) {
    return value.trim().toLowerCase();
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, "");
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
}
