import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveQrToken(qrToken: string) {
    const table = await this.prisma.cafeTable.findUnique({
      where: { qrToken },
      select: {
        id: true,
        code: true,
        displayName: true,
        capacity: true,
        qrToken: true,
        status: true,
        floor: {
          select: {
            id: true,
            name: true,
            sortOrder: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
            status: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException('Table QR token not found');
    }

    return {
      company: table.branch.company,
      branch: {
        id: table.branch.id,
        name: table.branch.name,
        slug: table.branch.slug,
        address: table.branch.address,
        status: table.branch.status,
      },
      floor: table.floor,
      table: {
        id: table.id,
        code: table.code,
        displayName: table.displayName,
        capacity: table.capacity,
        qrToken: table.qrToken,
        status: table.status,
      },
    };
  }
}
