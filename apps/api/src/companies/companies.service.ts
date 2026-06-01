import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const companies = await this.prisma.company.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { branches: true },
        },
      },
    });

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      branchesCount: company._count.branches,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    }));
  }

  async findBranches(companySlug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug: companySlug },
      select: {
        id: true,
        name: true,
        slug: true,
        branches: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                floors: true,
                tables: true,
              },
            },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
      branches: company.branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        slug: branch.slug,
        address: branch.address,
        status: branch.status,
        floorsCount: branch._count.floors,
        tablesCount: branch._count.tables,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
      })),
    };
  }
}
