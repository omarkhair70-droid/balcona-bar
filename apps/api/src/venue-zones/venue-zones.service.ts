import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VenueZoneStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVenueZoneDto,
  ListVenueZonesQueryDto,
  UpdateVenueZoneDto,
} from './dto/venue-zone.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const branchSelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  status: true,
} satisfies Prisma.BranchSelect;

const venueZoneSelect = {
  id: true,
  companyId: true,
  branchId: true,
  name: true,
  slug: true,
  type: true,
  status: true,
  description: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  branch: {
    select: branchSelect,
  },
  _count: {
    select: {
      presenceEvents: true,
    },
  },
} satisfies Prisma.VenueZoneSelect;

@Injectable()
export class VenueZonesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForBranch(branchId: string, query: ListVenueZonesQueryDto) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const where: Prisma.VenueZoneWhereInput = { branchId: branch.id };
    const search = this.normalizeSearch(query.search);

    if (query.type) {
      where.type = query.type;
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const venueZones = await this.prisma.venueZone.findMany({
      where,
      take: this.limit(query.limit),
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: venueZoneSelect,
    });

    return { branch, venueZones };
  }

  async create(branchId: string, body: CreateVenueZoneDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await this.findBranchOrThrow(branchId, tx);
        const venueZone = await tx.venueZone.create({
          data: {
            companyId: branch.companyId,
            branchId: branch.id,
            name: body.name.trim(),
            slug: body.slug.trim(),
            type: body.type,
            status: body.status ?? VenueZoneStatus.active,
            description: this.normalizeOptionalText(body.description),
            metadata: this.toNullableJson(body.metadata),
          },
          select: venueZoneSelect,
        });

        return { branch, venueZone };
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Venue zone slug must be unique per branch',
      );
    }
  }

  async get(venueZoneId: string) {
    const venueZone = await this.prisma.venueZone.findUnique({
      where: { id: venueZoneId },
      select: venueZoneSelect,
    });

    if (!venueZone) {
      throw new NotFoundException('Venue zone not found');
    }

    return { venueZone };
  }

  async update(venueZoneId: string, body: UpdateVenueZoneDto) {
    try {
      const existingZone = await this.prisma.venueZone.findUnique({
        where: { id: venueZoneId },
        select: { id: true },
      });

      if (!existingZone) {
        throw new NotFoundException('Venue zone not found');
      }

      const data: Prisma.VenueZoneUpdateInput = {};

      if (body.name !== undefined) {
        data.name = body.name.trim();
      }

      if (body.slug !== undefined) {
        data.slug = body.slug.trim();
      }

      if (body.type !== undefined) {
        data.type = body.type;
      }

      if (body.status !== undefined) {
        data.status = body.status;
      }

      if (this.hasOwn(body, 'description')) {
        data.description = this.normalizeOptionalText(body.description);
      }

      if (this.hasOwn(body, 'metadata')) {
        data.metadata = this.toNullableJson(body.metadata);
      }

      const venueZone = await this.prisma.venueZone.update({
        where: { id: existingZone.id },
        data,
        select: venueZoneSelect,
      });

      return { venueZone };
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Venue zone slug must be unique per branch',
      );
    }
  }

  async deleteOrArchive(venueZoneId: string) {
    const existingZone = await this.prisma.venueZone.findUnique({
      where: { id: venueZoneId },
      select: {
        id: true,
        _count: {
          select: {
            presenceEvents: true,
          },
        },
      },
    });

    if (!existingZone) {
      throw new NotFoundException('Venue zone not found');
    }

    if (existingZone._count.presenceEvents > 0) {
      const venueZone = await this.prisma.venueZone.update({
        where: { id: existingZone.id },
        data: { status: VenueZoneStatus.archived },
        select: venueZoneSelect,
      });

      return {
        deleted: false,
        archived: true,
        reason: 'Venue zone has presence events, so it was archived instead.',
        venueZone,
      };
    }

    const venueZone = await this.prisma.venueZone.delete({
      where: { id: existingZone.id },
      select: venueZoneSelect,
    });

    return { deleted: true, archived: false, venueZone };
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

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeSearch(value?: string) {
    const normalizedValue = value?.trim();

    return normalizedValue && normalizedValue.length > 0
      ? normalizedValue
      : undefined;
  }

  private limit(value?: number) {
    return value ?? 100;
  }

  private toNullableJson(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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
