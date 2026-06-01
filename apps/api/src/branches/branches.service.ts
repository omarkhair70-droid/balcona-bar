import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findTables(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tables: {
          orderBy: { code: 'asc' },
          select: {
            id: true,
            code: true,
            displayName: true,
            capacity: true,
            qrToken: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            floor: {
              select: {
                id: true,
                name: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }
}
