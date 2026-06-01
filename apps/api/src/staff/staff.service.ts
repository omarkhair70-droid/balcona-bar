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
}
