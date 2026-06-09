import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CompanySubscriptionStatus,
  PlatformAdminRole,
  PlatformAdminStatus,
  PreparationStation,
  PrinterAdapterType,
  SaasPlanStatus,
  SmartCashierMode,
  StaffRole,
  StaffStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { SmokeBootstrapCredentialDto, SmokeBootstrapDto } from "./dto/smoke-bootstrap.dto";
import {
  SMOKE_BOOTSTRAP_EMAILS,
  SMOKE_BOOTSTRAP_IDENTIFIERS,
  SmokeStaffRoleKey,
} from "./smoke-bootstrap.constants";

const PASSWORD_HASH_ROUNDS = 12;

const staffRoleMap: Record<SmokeStaffRoleKey, StaffRole> = {
  owner: StaffRole.owner,
  cashier: StaffRole.cashier,
  kitchen: StaffRole.kitchen,
  barista: StaffRole.barista,
  waiter: StaffRole.waiter,
};

@Injectable()
export class SmokeBootstrapService {
  private readonly logger = new Logger(SmokeBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async bootstrap(body: SmokeBootstrapDto, providedToken: string | undefined) {
    this.assertBootstrapAllowed(providedToken);
    this.assertSmokeCredentials(body);

    const staffPasswordHashes = await Promise.all(
      (Object.keys(staffRoleMap) as SmokeStaffRoleKey[]).map(async (role) => [
        role,
        await bcrypt.hash(body.credentials[role].password, PASSWORD_HASH_ROUNDS),
      ]),
    );
    const staffHashByRole = Object.fromEntries(staffPasswordHashes) as Record<
      SmokeStaffRoleKey,
      string
    >;
    const platformPasswordHash = body.credentials.platform
      ? await bcrypt.hash(body.credentials.platform.password, PASSWORD_HASH_ROUNDS)
      : null;

    const plan = await this.upsertSmokePlan();
    const company = await this.prisma.company.upsert({
      where: { slug: SMOKE_BOOTSTRAP_IDENTIFIERS.companySlug },
      update: {
        name: SMOKE_BOOTSTRAP_IDENTIFIERS.companyName,
        status: "active",
      },
      create: {
        name: SMOKE_BOOTSTRAP_IDENTIFIERS.companyName,
        slug: SMOKE_BOOTSTRAP_IDENTIFIERS.companySlug,
        status: "active",
      },
      select: { id: true, name: true, slug: true, status: true },
    });

    await this.prisma.companySubscription.upsert({
      where: { companyId: company.id },
      update: {
        planId: plan.id,
        status: CompanySubscriptionStatus.active,
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
        suspendedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        metadata: { source: "smoke_bootstrap", smoke: true },
      },
      create: {
        companyId: company.id,
        planId: plan.id,
        status: CompanySubscriptionStatus.active,
        currentPeriodStart: new Date(),
        metadata: { source: "smoke_bootstrap", smoke: true },
      },
    });

    const branch = await this.prisma.branch.upsert({
      where: {
        companyId_slug: {
          companyId: company.id,
          slug: SMOKE_BOOTSTRAP_IDENTIFIERS.branchSlug,
        },
      },
      update: {
        name: SMOKE_BOOTSTRAP_IDENTIFIERS.branchName,
        address: "Smoke demo data only. Safe to rerun bootstrap.",
        status: "active",
      },
      create: {
        companyId: company.id,
        name: SMOKE_BOOTSTRAP_IDENTIFIERS.branchName,
        slug: SMOKE_BOOTSTRAP_IDENTIFIERS.branchSlug,
        address: "Smoke demo data only. Safe to rerun bootstrap.",
        status: "active",
      },
      select: { id: true, companyId: true, name: true, slug: true, status: true },
    });

    const floor = await this.upsertFloor(branch.id);
    const tables = await this.upsertTables(branch.id, floor.id);
    const menu = await this.upsertMenu(company.id, branch.id);
    await this.upsertSmartCashierSettings(company.id, branch.id);
    await this.upsertPrinterStations(company.id, branch.id);
    const staffUsers = await this.upsertStaffUsers(
      company.id,
      branch.id,
      body,
      staffHashByRole,
    );
    const platformAdminUser =
      body.credentials.platform && platformPasswordHash
        ? await this.upsertPlatformAdminUser(
            body.credentials.platform,
            platformPasswordHash,
          )
        : null;

    this.logger.log({
      message: "Smoke bootstrap completed",
      companyId: company.id,
      branchId: branch.id,
      staffRoles: Object.keys(staffUsers),
      platformAdminCreatedOrUpdated: Boolean(platformAdminUser),
    });

    return {
      company,
      branch,
      tables,
      menuItem: menu.item,
      modifierGroups: menu.modifierGroups,
      staffUsers,
      platformAdminUser,
      env: {
        SMOKE_DEMO_BRANCH_SLUG: branch.slug,
        SMOKE_DEMO_TABLE_QR_TOKEN: tables[0]?.qrToken,
        SMOKE_DEMO_TABLE_2_QR_TOKEN: tables[1]?.qrToken,
        SMOKE_BRANCH_ID: branch.id,
        SMOKE_COMPANY_ID: company.id,
        SMOKE_MENU_ITEM_NAME: SMOKE_BOOTSTRAP_IDENTIFIERS.menuItemName,
        SMOKE_OWNER_EMAIL: body.credentials.owner.email,
        SMOKE_CASHIER_EMAIL: body.credentials.cashier.email,
        SMOKE_KITCHEN_EMAIL: body.credentials.kitchen.email,
        SMOKE_BARISTA_EMAIL: body.credentials.barista.email,
        SMOKE_WAITER_EMAIL: body.credentials.waiter.email,
        SMOKE_PLATFORM_EMAIL: body.credentials.platform?.email ?? "",
      },
      generated: {
        smokeOnly: true,
        passwordValuesReturned: false,
        platformSupported: Boolean(platformAdminUser),
      },
    };
  }

  assertBootstrapAllowed(providedToken: string | undefined) {
    const appEnvironment = this.configService.get<string>(
      "app.environment",
      "development",
    );
    const nodeEnvironment = this.configService.get<string>(
      "app.nodeEnvironment",
      "development",
    );
    const explicitlyEnabled = this.configService.get<boolean>(
      "smokeBootstrap.enabled",
      false,
    );
    const expectedToken = this.configService.get<string | undefined>(
      "smokeBootstrap.token",
    );

    if (appEnvironment === "production") {
      throw new ForbiddenException({
        code: "SMOKE_BOOTSTRAP_DISABLED_IN_PRODUCTION",
        message: "Smoke bootstrap is disabled in production",
      });
    }

    if (nodeEnvironment === "production" && !explicitlyEnabled) {
      throw new ForbiddenException({
        code: "SMOKE_BOOTSTRAP_DISABLED",
        message: "Smoke bootstrap is disabled",
      });
    }

    if (!expectedToken) {
      throw new BadRequestException({
        code: "SMOKE_BOOTSTRAP_TOKEN_MISSING",
        message: "Smoke bootstrap token is not configured",
      });
    }

    if (!providedToken || !this.secureTokenEquals(providedToken, expectedToken)) {
      throw new UnauthorizedException({
        code: "SMOKE_BOOTSTRAP_TOKEN_INVALID",
        message: "Smoke bootstrap token is invalid",
      });
    }
  }

  private assertSmokeCredentials(body: SmokeBootstrapDto) {
    if (!body.credentials) {
      throw new BadRequestException({
        code: "SMOKE_BOOTSTRAP_CREDENTIAL_MISSING",
        message: "Missing smoke bootstrap credentials",
      });
    }

    for (const [role, email] of Object.entries(SMOKE_BOOTSTRAP_EMAILS)) {
      const credential =
        body.credentials[role as keyof typeof body.credentials];

      if (!credential) {
        if (role === "platform") {
          continue;
        }

        throw new BadRequestException({
          code: "SMOKE_BOOTSTRAP_CREDENTIAL_MISSING",
          message: `Missing smoke credential for ${role}`,
        });
      }

      if (credential.email.trim().toLowerCase() !== email) {
        throw new BadRequestException({
          code: "SMOKE_BOOTSTRAP_NON_SMOKE_EMAIL",
          message: `Smoke bootstrap only accepts deterministic smoke email for ${role}`,
        });
      }
    }
  }

  private async upsertSmokePlan() {
    return this.prisma.saasPlan.upsert({
      where: { code: SMOKE_BOOTSTRAP_IDENTIFIERS.saasPlanCode },
      update: {
        name: "Smoke Pilot",
        status: SaasPlanStatus.active,
        description: "Smoke-only staging plan for automated full-platform smoke.",
        monthlyPriceMinor: null,
        currency: "EGP",
        maxBranches: 3,
        maxTables: 50,
        maxStaffUsers: 20,
        maxMenuItems: 50,
        maxInventoryItems: 50,
        maxAiMessagesPerMonth: 1000,
        setupEnabled: true,
        kdsEnabled: true,
        inventoryEnabled: true,
        onlinePaymentsEnabled: true,
        ownerAnalyticsEnabled: true,
        aiWaiterEnabled: true,
        multiBranchEnabled: true,
        advancedReportsEnabled: true,
        sortOrder: 900,
        metadata: { source: "smoke_bootstrap", smoke: true },
      },
      create: {
        code: SMOKE_BOOTSTRAP_IDENTIFIERS.saasPlanCode,
        name: "Smoke Pilot",
        status: SaasPlanStatus.active,
        description: "Smoke-only staging plan for automated full-platform smoke.",
        monthlyPriceMinor: null,
        currency: "EGP",
        maxBranches: 3,
        maxTables: 50,
        maxStaffUsers: 20,
        maxMenuItems: 50,
        maxInventoryItems: 50,
        maxAiMessagesPerMonth: 1000,
        setupEnabled: true,
        kdsEnabled: true,
        inventoryEnabled: true,
        onlinePaymentsEnabled: true,
        ownerAnalyticsEnabled: true,
        aiWaiterEnabled: true,
        multiBranchEnabled: true,
        advancedReportsEnabled: true,
        sortOrder: 900,
        metadata: { source: "smoke_bootstrap", smoke: true },
      },
      select: { id: true, code: true },
    });
  }

  private async upsertFloor(branchId: string) {
    return this.prisma.floor.upsert({
      where: {
        id: `${branchId}:${SMOKE_BOOTSTRAP_IDENTIFIERS.floorIdSuffix}`,
      },
      update: {
        name: SMOKE_BOOTSTRAP_IDENTIFIERS.floorName,
        sortOrder: 1,
      },
      create: {
        id: `${branchId}:${SMOKE_BOOTSTRAP_IDENTIFIERS.floorIdSuffix}`,
        branchId,
        name: SMOKE_BOOTSTRAP_IDENTIFIERS.floorName,
        sortOrder: 1,
      },
      select: { id: true, branchId: true, name: true },
    });
  }

  private async upsertTables(branchId: string, floorId: string) {
    const tableSeed = [
      {
        code: SMOKE_BOOTSTRAP_IDENTIFIERS.tableOneCode,
        displayName: "Smoke Table 1",
        qrToken: SMOKE_BOOTSTRAP_IDENTIFIERS.tableOneQrToken,
      },
      {
        code: SMOKE_BOOTSTRAP_IDENTIFIERS.tableTwoCode,
        displayName: "Smoke Table 2",
        qrToken: SMOKE_BOOTSTRAP_IDENTIFIERS.tableTwoQrToken,
      },
    ];
    const tables: {
      id: string;
      branchId: string;
      code: string;
      displayName: string;
      qrToken: string;
      status: string;
    }[] = [];

    for (const table of tableSeed) {
      tables.push(
        await this.prisma.cafeTable.upsert({
          where: {
            branchId_code: {
              branchId,
              code: table.code,
            },
          },
          update: {
            floorId,
            displayName: table.displayName,
            capacity: 4,
            qrToken: table.qrToken,
            status: "active",
          },
          create: {
            branchId,
            floorId,
            code: table.code,
            displayName: table.displayName,
            capacity: 4,
            qrToken: table.qrToken,
            status: "active",
          },
          select: {
            id: true,
            branchId: true,
            code: true,
            displayName: true,
            qrToken: true,
            status: true,
          },
        }),
      );
    }

    return tables;
  }

  private async upsertMenu(companyId: string, branchId: string) {
    const category = await this.prisma.menuCategory.upsert({
      where: {
        companyId_slug: {
          companyId,
          slug: SMOKE_BOOTSTRAP_IDENTIFIERS.categorySlug,
        },
      },
      update: {
        name: "Smoke Coffee",
        description: "Smoke-only menu category.",
        sortOrder: 1,
        status: "active",
      },
      create: {
        companyId,
        name: "Smoke Coffee",
        slug: SMOKE_BOOTSTRAP_IDENTIFIERS.categorySlug,
        description: "Smoke-only menu category.",
        sortOrder: 1,
        status: "active",
      },
      select: { id: true },
    });

    const item = await this.prisma.menuItem.upsert({
      where: {
        companyId_slug: {
          companyId,
          slug: SMOKE_BOOTSTRAP_IDENTIFIERS.menuItemSlug,
        },
      },
      update: {
        categoryId: category.id,
        name: SMOKE_BOOTSTRAP_IDENTIFIERS.menuItemName,
        description: "Smoke-only Spanish Latte for staging smoke orders.",
        basePriceMinor: 11500,
        currency: "EGP",
        station: PreparationStation.barista,
        status: "active",
        isFeatured: true,
        sortOrder: 1,
      },
      create: {
        companyId,
        categoryId: category.id,
        name: SMOKE_BOOTSTRAP_IDENTIFIERS.menuItemName,
        slug: SMOKE_BOOTSTRAP_IDENTIFIERS.menuItemSlug,
        description: "Smoke-only Spanish Latte for staging smoke orders.",
        basePriceMinor: 11500,
        currency: "EGP",
        station: PreparationStation.barista,
        status: "active",
        isFeatured: true,
        sortOrder: 1,
      },
      select: { id: true, name: true, slug: true },
    });

    const modifierGroups: { id: string; name: string; slug: string }[] = [];

    for (const group of [
      {
        name: "Size",
        slug: SMOKE_BOOTSTRAP_IDENTIFIERS.sizeGroupSlug,
        minSelections: 1,
        options: [
          { name: "Small", slug: "small", priceDeltaMinor: 0, sortOrder: 1 },
          { name: "Medium", slug: "medium", priceDeltaMinor: 1000, sortOrder: 2 },
        ],
      },
      {
        name: "Temperature",
        slug: SMOKE_BOOTSTRAP_IDENTIFIERS.temperatureGroupSlug,
        minSelections: 1,
        options: [
          { name: "Hot", slug: "hot", priceDeltaMinor: 0, sortOrder: 1 },
          { name: "Iced", slug: "iced", priceDeltaMinor: 0, sortOrder: 2 },
        ],
      },
    ]) {
      const modifierGroup = await this.prisma.modifierGroup.upsert({
        where: { companyId_slug: { companyId, slug: group.slug } },
        update: {
          name: group.name,
          description: "Smoke-only required modifier group.",
          selectionType: "single",
          isRequired: true,
          minSelections: group.minSelections,
          maxSelections: 1,
          sortOrder: modifierGroups.length + 1,
          status: "active",
        },
        create: {
          companyId,
          name: group.name,
          slug: group.slug,
          description: "Smoke-only required modifier group.",
          selectionType: "single",
          isRequired: true,
          minSelections: group.minSelections,
          maxSelections: 1,
          sortOrder: modifierGroups.length + 1,
          status: "active",
        },
        select: { id: true, name: true, slug: true },
      });

      for (const option of group.options) {
        await this.prisma.modifierOption.upsert({
          where: {
            groupId_slug: {
              groupId: modifierGroup.id,
              slug: option.slug,
            },
          },
          update: {
            name: option.name,
            priceDeltaMinor: option.priceDeltaMinor,
            sortOrder: option.sortOrder,
            status: "active",
          },
          create: {
            groupId: modifierGroup.id,
            name: option.name,
            slug: option.slug,
            priceDeltaMinor: option.priceDeltaMinor,
            sortOrder: option.sortOrder,
            status: "active",
          },
        });
      }

      await this.prisma.menuItemModifierGroup.upsert({
        where: {
          menuItemId_modifierGroupId: {
            menuItemId: item.id,
            modifierGroupId: modifierGroup.id,
          },
        },
        update: { sortOrder: modifierGroups.length + 1 },
        create: {
          menuItemId: item.id,
          modifierGroupId: modifierGroup.id,
          sortOrder: modifierGroups.length + 1,
        },
      });
      modifierGroups.push(modifierGroup);
    }

    await this.prisma.branchMenuItemOverride.upsert({
      where: {
        branchId_menuItemId: {
          branchId,
          menuItemId: item.id,
        },
      },
      update: {
        priceOverrideMinor: null,
        isAvailable: true,
        isVisible: true,
        sortOrder: 1,
      },
      create: {
        branchId,
        menuItemId: item.id,
        priceOverrideMinor: null,
        isAvailable: true,
        isVisible: true,
        sortOrder: 1,
      },
    });

    return { item, modifierGroups };
  }

  private async upsertSmartCashierSettings(companyId: string, branchId: string) {
    await this.prisma.branchSmartCashierSettings.upsert({
      where: { branchId },
      update: {
        enabled: false,
        mode: SmartCashierMode.manual_only,
        maxAutoAcceptSubtotalMinor: null,
        requirePaymentBeforeAutoAccept: false,
        reviewCustomerNotes: true,
      },
      create: {
        companyId,
        branchId,
        enabled: false,
        mode: SmartCashierMode.manual_only,
        maxAutoAcceptSubtotalMinor: null,
        requirePaymentBeforeAutoAccept: false,
        reviewCustomerNotes: true,
      },
    });
  }

  private async upsertPrinterStations(companyId: string, branchId: string) {
    const stations = [
      {
        name: "Smoke Barista Printer",
        slug: "smoke-barista-printer",
        station: PreparationStation.barista,
      },
      {
        name: "Smoke Kitchen Printer",
        slug: "smoke-kitchen-printer",
        station: PreparationStation.kitchen,
      },
      {
        name: "Smoke Dessert Printer",
        slug: "smoke-dessert-printer",
        station: PreparationStation.dessert,
      },
      {
        name: "Smoke Receipt Printer",
        slug: "smoke-receipt-printer",
        station: null,
      },
    ];

    for (const station of stations) {
      await this.prisma.printerStation.upsert({
        where: { branchId_slug: { branchId, slug: station.slug } },
        update: {
          name: station.name,
          station: station.station,
          adapterType: PrinterAdapterType.mock,
          status: "active",
          isDefault: true,
          config: { source: "smoke_bootstrap", smoke: true },
        },
        create: {
          companyId,
          branchId,
          name: station.name,
          slug: station.slug,
          station: station.station,
          adapterType: PrinterAdapterType.mock,
          status: "active",
          isDefault: true,
          config: { source: "smoke_bootstrap", smoke: true },
        },
      });
    }
  }

  private async upsertStaffUsers(
    companyId: string,
    branchId: string,
    body: SmokeBootstrapDto,
    passwordHashByRole: Record<SmokeStaffRoleKey, string>,
  ) {
    const output: Record<string, { id: string; email: string; role: StaffRole }> = {};

    for (const roleKey of Object.keys(staffRoleMap) as SmokeStaffRoleKey[]) {
      const credential = body.credentials[roleKey];
      const role = staffRoleMap[roleKey];
      const staffUser = await this.prisma.staffUser.upsert({
        where: { email: credential.email },
        update: {
          name: `Smoke ${this.toTitle(roleKey)}`,
          status: StaffStatus.active,
          passwordHash: passwordHashByRole[roleKey],
          passwordSetAt: new Date(),
        },
        create: {
          email: credential.email,
          name: `Smoke ${this.toTitle(roleKey)}`,
          status: StaffStatus.active,
          passwordHash: passwordHashByRole[roleKey],
          passwordSetAt: new Date(),
        },
        select: { id: true, email: true },
      });
      const membershipBranchId = role === StaffRole.owner ? null : branchId;
      const existingMembership = await this.prisma.staffMembership.findFirst({
        where: {
          staffUserId: staffUser.id,
          companyId,
          branchId: membershipBranchId,
          role,
        },
        select: { id: true },
      });

      if (existingMembership) {
        await this.prisma.staffMembership.update({
          where: { id: existingMembership.id },
          data: { status: StaffStatus.active },
        });
      } else {
        await this.prisma.staffMembership.create({
          data: {
            staffUserId: staffUser.id,
            companyId,
            branchId: membershipBranchId,
            role,
            status: StaffStatus.active,
          },
        });
      }

      output[roleKey] = { id: staffUser.id, email: staffUser.email, role };
    }

    return output;
  }

  private async upsertPlatformAdminUser(
    credential: SmokeBootstrapCredentialDto,
    passwordHash: string,
  ) {
    return this.prisma.platformAdminUser.upsert({
      where: { email: credential.email },
      update: {
        name: "Smoke Platform Admin",
        passwordHash,
        role: PlatformAdminRole.owner,
        status: PlatformAdminStatus.active,
      },
      create: {
        email: credential.email,
        name: "Smoke Platform Admin",
        passwordHash,
        role: PlatformAdminRole.owner,
        status: PlatformAdminStatus.active,
      },
      select: { id: true, email: true, role: true, status: true },
    });
  }

  private secureTokenEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private toTitle(value: string) {
    return value.slice(0, 1).toUpperCase() + value.slice(1);
  }
}
