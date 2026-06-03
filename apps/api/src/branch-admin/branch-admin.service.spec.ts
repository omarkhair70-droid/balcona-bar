import { BadRequestException } from '@nestjs/common';
import { BranchStatus, CompanyStatus, TableStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BranchAdminService } from './branch-admin.service';

const now = new Date('2026-01-01T00:00:00.000Z');

const company = {
  id: 'company-1',
  name: 'Demo Cafe',
  slug: 'demo-cafe',
  status: CompanyStatus.active,
  createdAt: now,
  updatedAt: now,
};

const branch = {
  id: 'branch-1',
  companyId: company.id,
  name: 'Main Branch',
  slug: 'main',
  address: null,
  status: BranchStatus.active,
  createdAt: now,
  updatedAt: now,
};

const floor = {
  id: 'floor-1',
  branchId: branch.id,
  name: 'Ground Floor',
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
};

function buildTable(overrides: Partial<{
  id: string;
  branchId: string;
  floorId: string | null;
  code: string;
  displayName: string;
  capacity: number | null;
  qrToken: string;
  status: TableStatus;
}> = {}) {
  return {
    id: overrides.id ?? 'table-1',
    branchId: overrides.branchId ?? branch.id,
    floorId: overrides.floorId === undefined ? floor.id : overrides.floorId,
    code: overrides.code ?? 'T01',
    displayName: overrides.displayName ?? 'Table 1',
    capacity: overrides.capacity === undefined ? 4 : overrides.capacity,
    qrToken: overrides.qrToken ?? 'main-t01',
    status: overrides.status ?? TableStatus.active,
    createdAt: now,
    updatedAt: now,
    floor,
    tableSessions: [],
  };
}

function createService(prismaOverrides: Partial<PrismaService>) {
  return new BranchAdminService(prismaOverrides as PrismaService);
}

describe('BranchAdminService', () => {
  it('reports missing QR setup issues in branch overview', async () => {
    const service = createService({
      company: {
        findUnique: jest.fn().mockResolvedValue(company),
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...branch,
            _count: {
              floors: 1,
              tables: 1,
            },
          },
        ]),
      },
      floor: {
        findMany: jest.fn().mockResolvedValue([floor]),
      },
      cafeTable: {
        findMany: jest.fn().mockResolvedValue([
          buildTable({
            qrToken: '',
          }),
        ]),
      },
      tableSession: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService);

    const result = await service.getOverview(company.id, {});

    expect(result.stats.tablesMissingQrToken).toBe(1);
    expect(result.setupIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'table_missing_qr_token',
          severity: 'error',
          tableId: 'table-1',
        }),
      ]),
    );
  });

  it('creates branches with company ownership and wrapped response', async () => {
    const branchCreate = jest.fn().mockResolvedValue(branch);
    const service = createService({
      $transaction: jest.fn((callback) =>
        callback({
          company: {
            findUnique: jest.fn().mockResolvedValue(company),
          },
          branch: {
            create: branchCreate,
          },
        }),
      ),
    } as unknown as PrismaService);

    const result = await service.createBranch(company.id, {
      name: 'Main Branch',
      slug: 'main',
      address: null,
      status: BranchStatus.active,
    });

    expect(branchCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: company.id,
          slug: 'main',
        }),
      }),
    );
    expect(result).toEqual({ company, branch });
  });

  it('generates a unique QR token suffix when the stable token is taken', async () => {
    const tableCreate = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve(
        buildTable({
          qrToken: data.qrToken,
        }),
      ),
    );
    const service = createService({
      $transaction: jest.fn((callback) =>
        callback({
          branch: {
            findUnique: jest.fn().mockResolvedValue(branch),
          },
          floor: {
            findUnique: jest.fn().mockResolvedValue(floor),
          },
          cafeTable: {
            findUnique: jest
              .fn()
              .mockResolvedValueOnce({ id: 'existing-table' })
              .mockResolvedValueOnce(null),
            create: tableCreate,
          },
        }),
      ),
    } as unknown as PrismaService);

    const result = await service.createTable(branch.id, {
      code: 'T01',
      displayName: 'Table 1',
      capacity: 4,
      floorId: floor.id,
      status: TableStatus.active,
    });

    expect(tableCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qrToken: 'main-t01-2',
        }),
      }),
    );
    expect(result.table.qrToken).toBe('main-t01-2');
  });

  it('rejects table floor assignment across branches', async () => {
    const service = createService({
      $transaction: jest.fn((callback) =>
        callback({
          cafeTable: {
            findUnique: jest.fn().mockResolvedValue(buildTable()),
          },
          floor: {
            findUnique: jest.fn().mockResolvedValue({
              ...floor,
              id: 'other-floor',
              branchId: 'other-branch',
            }),
          },
        }),
      ),
    } as unknown as PrismaService);

    await expect(
      service.updateTable('table-1', {
        floorId: 'other-floor',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
