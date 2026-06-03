import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BranchStatus,
  Prisma,
  TableAttentionStatus,
  TableSessionStatus,
  TableStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BranchAdminOverviewQueryDto,
  CreateBranchDto,
  CreateFloorDto,
  CreateTableDto,
  RegenerateQrTokenDto,
  UpdateBranchDto,
  UpdateFloorDto,
  UpdateTableDto,
} from './dto/branch-admin.dto';
import { QR_TOKEN_PATTERN } from './dto/branch-admin-values';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const openSessionStatuses = [TableSessionStatus.active, TableSessionStatus.idle];

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

const attentionSnapshotSelect = {
  id: true,
  status: true,
  priority: true,
  score: true,
  lastEvaluatedAt: true,
  resolvedAt: true,
  mutedUntil: true,
} satisfies Prisma.TableAttentionSnapshotSelect;

const tableSessionSelect = {
  id: true,
  companyId: true,
  branchId: true,
  tableId: true,
  status: true,
  source: true,
  guestLabel: true,
  partySize: true,
  startedAt: true,
  lastSeenAt: true,
  expiresAt: true,
  closedAt: true,
  closeReason: true,
  createdAt: true,
  updatedAt: true,
  tableAttentionSnapshot: {
    select: attentionSnapshotSelect,
  },
} satisfies Prisma.TableSessionSelect;

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
  tableSessions: {
    where: {
      status: {
        in: openSessionStatuses,
      },
    },
    orderBy: {
      lastSeenAt: 'desc' as const,
    },
    take: 1,
    select: tableSessionSelect,
  },
} satisfies Prisma.CafeTableSelect;

type CompanyRecord = Prisma.CompanyGetPayload<{ select: typeof companySelect }>;
type BranchRecord = Prisma.BranchGetPayload<{ select: typeof branchSelect }>;
type FloorRecord = Prisma.FloorGetPayload<{ select: typeof floorSelect }>;
type TableRecord = Prisma.CafeTableGetPayload<{ select: typeof tableSelect }>;
type TableSessionRecord = Prisma.TableSessionGetPayload<{
  select: typeof tableSessionSelect;
}>;

type BranchSetupIssueScope = 'company' | 'branch' | 'floor' | 'table' | 'qr';
type BranchSetupIssueSeverity = 'warning' | 'error';

type BranchSetupIssue = {
  code: string;
  severity: BranchSetupIssueSeverity;
  scope: BranchSetupIssueScope;
  message: string;
  branchId?: string;
  floorId?: string | null;
  tableId?: string;
};

@Injectable()
export class BranchAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(companyId: string, query: BranchAdminOverviewQueryDto) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const branches = await this.prisma.branch.findMany({
      where: { companyId: company.id },
      orderBy: [{ name: 'asc' }],
      select: {
        ...branchSelect,
        _count: {
          select: {
            floors: true,
            tables: true,
          },
        },
      },
    });
    const selectedBranchId = query.branchId ?? branches[0]?.id;

    if (!selectedBranchId) {
      return {
        company,
        branches: [],
        selectedBranch: null,
        floors: [],
        tablesByFloor: [],
        ungroupedTables: [],
        activeSessions: [],
        stats: this.emptyStats(1),
        setupIssues: [
          {
            code: 'company_has_no_branches',
            severity: 'error',
            scope: 'company',
            message: 'This company has no branches configured.',
          },
        ] satisfies BranchSetupIssue[],
      };
    }

    const selectedBranch = branches.find(
      (branch) => branch.id === selectedBranchId,
    );

    if (!selectedBranch) {
      throw new NotFoundException('Selected branch was not found in company');
    }

    const [floors, tables, activeSessions] = await Promise.all([
      this.prisma.floor.findMany({
        where: { branchId: selectedBranch.id },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: floorSelect,
      }),
      this.prisma.cafeTable.findMany({
        where: { branchId: selectedBranch.id },
        orderBy: [
          { floor: { sortOrder: 'asc' } },
          { floor: { name: 'asc' } },
          { code: 'asc' },
        ],
        select: tableSelect,
      }),
      this.prisma.tableSession.findMany({
        where: {
          branchId: selectedBranch.id,
          status: {
            in: openSessionStatuses,
          },
        },
        orderBy: [{ lastSeenAt: 'desc' }],
        select: {
          ...tableSessionSelect,
          table: {
            select: {
              id: true,
              code: true,
              displayName: true,
              qrToken: true,
              status: true,
              floor: {
                select: floorSelect,
              },
            },
          },
        },
      }),
    ]);

    const tableSummaries = tables.map((table) => this.toTableSummary(table));
    const activeTableCount = tableSummaries.filter(
      (table) => table.status === TableStatus.active,
    ).length;
    const activeSessionsByTableId = new Map(
      tableSummaries
        .filter((table) => table.activeSession)
        .map((table) => [table.id, table.activeSession]),
    );
    const setupIssues = this.collectSetupIssues(
      selectedBranch,
      tableSummaries,
      activeSessionsByTableId,
    );
    const floorsWithTables = floors.map((floor) => ({
      ...floor,
      tables: tableSummaries.filter((table) => table.floorId === floor.id),
      tableCount: tableSummaries.filter((table) => table.floorId === floor.id)
        .length,
    }));
    const ungroupedTables = tableSummaries.filter((table) => !table.floorId);
    const activeSessionSummaries = activeSessions.map((session) =>
      this.toActiveSessionSummary(session),
    );

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
      selectedBranch: {
        id: selectedBranch.id,
        companyId: selectedBranch.companyId,
        name: selectedBranch.name,
        slug: selectedBranch.slug,
        address: selectedBranch.address,
        status: selectedBranch.status,
        createdAt: selectedBranch.createdAt,
        updatedAt: selectedBranch.updatedAt,
        floorsCount: selectedBranch._count.floors,
        tablesCount: selectedBranch._count.tables,
      },
      floors,
      tablesByFloor: floorsWithTables,
      ungroupedTables,
      activeSessions: activeSessionSummaries,
      stats: {
        totalTables: tableSummaries.length,
        activeTables: activeTableCount,
        inactiveTables: tableSummaries.filter(
          (table) => table.status === TableStatus.inactive,
        ).length,
        maintenanceTables: tableSummaries.filter(
          (table) => table.status === TableStatus.maintenance,
        ).length,
        occupiedTables: activeSessionSummaries.length,
        activeSessions: activeSessionSummaries.length,
        needsAttention: activeSessionSummaries.filter((session) =>
          this.needsAttention(session.tableAttentionSnapshot?.status),
        ).length,
        tablesWithQrToken: tableSummaries.filter((table) =>
          this.hasQrToken(table.qrToken),
        ).length,
        tablesMissingQrToken: tableSummaries.filter(
          (table) => !this.hasQrToken(table.qrToken),
        ).length,
        setupWarnings: setupIssues.length,
      },
      setupIssues,
    };
  }

  async createBranch(companyId: string, body: CreateBranchDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const company = await this.findCompanyOrThrow(companyId, tx);
        const branch = await tx.branch.create({
          data: {
            companyId: company.id,
            name: body.name.trim(),
            slug: body.slug.trim(),
            address: this.normalizeOptionalText(body.address),
            status: body.status ?? BranchStatus.active,
          },
          select: branchSelect,
        });

        return { company, branch };
      });
    } catch (error) {
      this.handleKnownWriteError(error, 'Branch slug must be unique per company');
    }
  }

  async updateBranch(branchId: string, body: UpdateBranchDto) {
    try {
      const existingBranch = await this.findBranchOrThrow(
        branchId,
        this.prisma,
      );
      const data: Prisma.BranchUpdateInput = {};

      if (body.name !== undefined) {
        data.name = body.name.trim();
      }

      if (body.slug !== undefined) {
        data.slug = body.slug.trim();
      }

      if (this.hasOwn(body, 'address')) {
        data.address = this.normalizeOptionalText(body.address);
      }

      if (body.status !== undefined) {
        data.status = body.status;
      }

      const branch = await this.prisma.branch.update({
        where: { id: existingBranch.id },
        data,
        select: branchSelect,
      });

      return { branch };
    } catch (error) {
      this.handleKnownWriteError(error, 'Branch slug must be unique per company');
    }
  }

  activateBranch(branchId: string) {
    return this.updateBranchStatus(branchId, BranchStatus.active);
  }

  deactivateBranch(branchId: string) {
    return this.updateBranchStatus(branchId, BranchStatus.inactive);
  }

  async createFloor(branchId: string, body: CreateFloorDto) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const floor = await this.prisma.floor.create({
      data: {
        branchId: branch.id,
        name: body.name.trim(),
        sortOrder: body.sortOrder ?? 0,
      },
      select: floorSelect,
    });

    return { branch, floor };
  }

  async updateFloor(floorId: string, body: UpdateFloorDto) {
    const existingFloor = await this.findFloorOrThrow(floorId, this.prisma);
    const data: Prisma.FloorUpdateInput = {};

    if (body.name !== undefined) {
      data.name = body.name.trim();
    }

    if (body.sortOrder !== undefined) {
      data.sortOrder = body.sortOrder;
    }

    const floor = await this.prisma.floor.update({
      where: { id: existingFloor.id },
      data,
      select: floorSelect,
    });

    return { floor };
  }

  async createTable(branchId: string, body: CreateTableDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await this.findBranchOrThrow(branchId, tx);
        const floor = body.floorId
          ? await this.findFloorOrThrow(body.floorId, tx)
          : null;
        this.assertFloorBelongsToBranch(floor, branch.id);
        const qrToken = body.qrToken
          ? await this.normalizeAndAssertQrToken(body.qrToken, tx)
          : await this.generateAvailableQrToken(branch, body.code, tx);
        const table = await tx.cafeTable.create({
          data: {
            branchId: branch.id,
            floorId: floor?.id ?? null,
            code: this.normalizeCode(body.code),
            displayName: body.displayName.trim(),
            capacity: body.capacity ?? null,
            qrToken,
            status: body.status ?? TableStatus.active,
          },
          select: tableSelect,
        });

        return { branch, table: this.toTableSummary(table), generatedQrToken: qrToken };
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Table code must be unique per branch and QR token must be unique',
      );
    }
  }

  async updateTable(tableId: string, body: UpdateTableDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingTable = await this.findTableOrThrow(tableId, tx);
        const data: Prisma.CafeTableUpdateInput = {};

        if (body.floorId !== undefined) {
          const floor =
            body.floorId === null || body.floorId.trim() === ''
              ? null
              : await this.findFloorOrThrow(body.floorId, tx);
          this.assertFloorBelongsToBranch(floor, existingTable.branchId);
          data.floor = floor
            ? { connect: { id: floor.id } }
            : { disconnect: true };
        }

        if (body.code !== undefined) {
          data.code = this.normalizeCode(body.code);
        }

        if (body.displayName !== undefined) {
          data.displayName = body.displayName.trim();
        }

        if (this.hasOwn(body, 'capacity')) {
          data.capacity = body.capacity ?? null;
        }

        if (body.qrToken !== undefined) {
          data.qrToken = await this.normalizeAndAssertQrToken(
            body.qrToken,
            tx,
            existingTable.id,
          );
        }

        if (body.status !== undefined) {
          data.status = body.status;
        }

        const table = await tx.cafeTable.update({
          where: { id: existingTable.id },
          data,
          select: tableSelect,
        });

        return { table: this.toTableSummary(table) };
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Table code must be unique per branch and QR token must be unique',
      );
    }
  }

  activateTable(tableId: string) {
    return this.updateTableStatus(tableId, TableStatus.active);
  }

  deactivateTable(tableId: string) {
    return this.updateTableStatus(tableId, TableStatus.inactive);
  }

  async generateQrToken(tableId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existingTable = await this.findTableOrThrow(tableId, tx);

      if (this.hasQrToken(existingTable.qrToken)) {
        return {
          table: this.toTableSummary(existingTable),
          qrToken: existingTable.qrToken,
          generated: false,
        };
      }

      const branch = await this.findBranchOrThrow(existingTable.branchId, tx);
      const qrToken = await this.generateAvailableQrToken(
        branch,
        existingTable.code,
        tx,
        existingTable.id,
      );
      const table = await tx.cafeTable.update({
        where: { id: existingTable.id },
        data: { qrToken },
        select: tableSelect,
      });

      return {
        table: this.toTableSummary(table),
        qrToken,
        generated: true,
      };
    });
  }

  async regenerateQrToken(tableId: string, body: RegenerateQrTokenDto) {
    if (!body.confirmPrintedQrInvalidation) {
      throw new BadRequestException(
        'Regenerating a QR token requires confirmation because printed QR codes will stop working.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existingTable = await this.findTableOrThrow(tableId, tx);
      const branch = await this.findBranchOrThrow(existingTable.branchId, tx);
      const qrToken = await this.generateAvailableQrToken(
        branch,
        existingTable.code,
        tx,
        existingTable.id,
      );
      const table = await tx.cafeTable.update({
        where: { id: existingTable.id },
        data: { qrToken },
        select: tableSelect,
      });

      return {
        table: this.toTableSummary(table),
        qrToken,
        generated: true,
      };
    });
  }

  private async updateBranchStatus(branchId: string, status: BranchStatus) {
    await this.findBranchOrThrow(branchId, this.prisma);
    const branch = await this.prisma.branch.update({
      where: { id: branchId },
      data: { status },
      select: branchSelect,
    });

    return { branch };
  }

  private async updateTableStatus(tableId: string, status: TableStatus) {
    const existingTable = await this.findTableOrThrow(tableId, this.prisma);
    const table = await this.prisma.cafeTable.update({
      where: { id: existingTable.id },
      data: { status },
      select: tableSelect,
    });

    return { table: this.toTableSummary(table) };
  }

  private collectSetupIssues(
    branch: BranchRecord,
    tables: ReturnType<BranchAdminService['toTableSummary']>[],
    activeSessionsByTableId: Map<string, unknown>,
  ) {
    const issues: BranchSetupIssue[] = [];
    const activeTables = tables.filter(
      (table) => table.status === TableStatus.active,
    );

    if (branch.status !== BranchStatus.active) {
      issues.push({
        code: 'branch_inactive',
        severity: 'error',
        scope: 'branch',
        branchId: branch.id,
        message: `${branch.name} is inactive and cannot start customer QR sessions.`,
      });
    }

    if (tables.length === 0) {
      issues.push({
        code: 'branch_has_no_tables',
        severity: 'error',
        scope: 'branch',
        branchId: branch.id,
        message: `${branch.name} has no tables configured.`,
      });
    }

    if (activeTables.length === 0) {
      issues.push({
        code: 'branch_has_no_active_tables',
        severity: 'error',
        scope: 'branch',
        branchId: branch.id,
        message: `${branch.name} has no active tables ready for guests.`,
      });
    }

    if (branch.status !== BranchStatus.active && activeTables.length > 0) {
      issues.push({
        code: 'branch_inactive_with_active_tables',
        severity: 'warning',
        scope: 'branch',
        branchId: branch.id,
        message: `${branch.name} is inactive but still has active tables.`,
      });
    }

    for (const table of tables) {
      if (table.status !== TableStatus.active && activeSessionsByTableId.has(table.id)) {
        issues.push({
          code: 'inactive_table_has_open_session',
          severity: 'error',
          scope: 'table',
          branchId: branch.id,
          floorId: table.floorId,
          tableId: table.id,
          message: `${table.displayName} is ${table.status} but has an open customer session.`,
        });
      }

      if (!this.hasQrToken(table.qrToken)) {
        issues.push({
          code: 'table_missing_qr_token',
          severity: table.status === TableStatus.active ? 'error' : 'warning',
          scope: 'qr',
          branchId: branch.id,
          floorId: table.floorId,
          tableId: table.id,
          message: `${table.displayName} is missing a QR token and cannot open a customer table link.`,
        });
      } else if (!QR_TOKEN_PATTERN.test(table.qrToken)) {
        issues.push({
          code: 'table_qr_token_unsafe_format',
          severity: 'warning',
          scope: 'qr',
          branchId: branch.id,
          floorId: table.floorId,
          tableId: table.id,
          message: `${table.displayName} has a QR token with an unsafe format.`,
        });
      }

      if (
        table.status === TableStatus.active &&
        (!table.capacity || table.capacity < 1)
      ) {
        issues.push({
          code: 'table_capacity_missing_or_invalid',
          severity: 'warning',
          scope: 'table',
          branchId: branch.id,
          floorId: table.floorId,
          tableId: table.id,
          message: `${table.displayName} is active but has no valid seating capacity.`,
        });
      }
    }

    if (
      branch.status === BranchStatus.active &&
      activeTables.length > 0 &&
      activeTables.every((table) => !this.hasQrToken(table.qrToken))
    ) {
      issues.push({
        code: 'no_customer_demo_link_possible',
        severity: 'error',
        scope: 'qr',
        branchId: branch.id,
        message: 'No active table has a QR token, so no customer preview link can be opened.',
      });
    }

    return issues;
  }

  private toTableSummary(table: TableRecord) {
    const activeSession = table.tableSessions[0];

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
      activeSession: activeSession
        ? this.toSessionSummary(activeSession)
        : null,
    };
  }

  private toActiveSessionSummary(
    session: TableSessionRecord & {
      table?: {
        id: string;
        code: string;
        displayName: string;
        qrToken: string;
        status: TableStatus;
        floor: FloorRecord | null;
      };
    },
  ) {
    return {
      ...this.toSessionSummary(session),
      table: session.table,
    };
  }

  private toSessionSummary(session: TableSessionRecord) {
    return {
      id: session.id,
      companyId: session.companyId,
      branchId: session.branchId,
      tableId: session.tableId,
      status: session.status,
      source: session.source,
      guestLabel: session.guestLabel,
      partySize: session.partySize,
      startedAt: session.startedAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      closedAt: session.closedAt,
      closeReason: session.closeReason,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      tableAttentionSnapshot: session.tableAttentionSnapshot,
    };
  }

  private emptyStats(setupWarnings = 0) {
    return {
      totalTables: 0,
      activeTables: 0,
      inactiveTables: 0,
      maintenanceTables: 0,
      occupiedTables: 0,
      activeSessions: 0,
      needsAttention: 0,
      tablesWithQrToken: 0,
      tablesMissingQrToken: 0,
      setupWarnings,
    };
  }

  private async generateAvailableQrToken(
    branch: BranchRecord,
    tableCode: string,
    tx: PrismaExecutor,
    excludeTableId?: string,
  ) {
    const baseToken = this.normalizeQrToken(
      `${branch.slug}-${this.normalizeCode(tableCode).toLowerCase()}`,
    );

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = attempt === 0 ? baseToken : `${baseToken}-${attempt + 1}`;
      const existing = await tx.cafeTable.findUnique({
        where: { qrToken: candidate },
        select: { id: true },
      });

      if (!existing || existing.id === excludeTableId) {
        return candidate;
      }
    }

    throw new BadRequestException('Could not generate a unique QR token');
  }

  private async normalizeAndAssertQrToken(
    value: string,
    tx: PrismaExecutor,
    excludeTableId?: string,
  ) {
    const qrToken = this.normalizeQrToken(value);
    const existing = await tx.cafeTable.findUnique({
      where: { qrToken },
      select: { id: true },
    });

    if (existing && existing.id !== excludeTableId) {
      throw new BadRequestException('QR token must be unique');
    }

    return qrToken;
  }

  private normalizeQrToken(value: string) {
    const qrToken = value.trim().toLowerCase();

    if (!QR_TOKEN_PATTERN.test(qrToken)) {
      throw new BadRequestException(
        'QR token must use lowercase letters, numbers, and hyphens',
      );
    }

    return qrToken;
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase();
  }

  private assertFloorBelongsToBranch(
    floor: FloorRecord | null,
    branchId: string,
  ) {
    if (floor && floor.branchId !== branchId) {
      throw new BadRequestException('Floor must belong to the selected branch');
    }
  }

  private async findCompanyOrThrow(companyId: string, tx: PrismaExecutor) {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: companySelect,
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  private async findBranchOrThrow(branchId: string, tx: PrismaExecutor) {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: branchSelect,
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async findFloorOrThrow(floorId: string, tx: PrismaExecutor) {
    const floor = await tx.floor.findUnique({
      where: { id: floorId },
      select: floorSelect,
    });

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    return floor;
  }

  private async findTableOrThrow(tableId: string, tx: PrismaExecutor) {
    const table = await tx.cafeTable.findUnique({
      where: { id: tableId },
      select: tableSelect,
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  private needsAttention(status?: TableAttentionStatus | null) {
    return (
      status === TableAttentionStatus.needs_attention ||
      status === TableAttentionStatus.urgent
    );
  }

  private hasQrToken(value?: string | null) {
    return Boolean(value?.trim());
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private handleKnownWriteError(error: unknown, uniqueMessage: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(uniqueMessage);
    }

    throw error;
  }

  private hasOwn(value: object, key: string) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }
}
