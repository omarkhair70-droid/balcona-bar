import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.staffUser.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          orderBy: [{ role: 'asc' }],
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  }

  async findVisibleForAccess(input: {
    companyIds: string[];
    branchIds: string[];
  }) {
    const scopeFilters = [
      input.companyIds.length > 0
        ? {
            companyId: {
              in: input.companyIds,
            },
            branchId: null,
          }
        : undefined,
      input.branchIds.length > 0
        ? {
            branchId: {
              in: input.branchIds,
            },
          }
        : undefined,
    ].filter(
      (
        filter,
      ): filter is
        | { companyId: { in: string[] }; branchId: null }
        | { branchId: { in: string[] } } => Boolean(filter),
    );

    if (scopeFilters.length === 0) {
      return [];
    }

    return this.prisma.staffUser.findMany({
      where: {
        memberships: {
          some: {
            OR: scopeFilters,
          },
        },
      },
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          where: {
            OR: scopeFilters,
          },
          orderBy: [{ role: 'asc' }],
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  }
}
