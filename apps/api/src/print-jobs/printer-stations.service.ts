import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PreparationStation,
  PrinterAdapterType,
  PrinterStationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import {
  CreatePrinterStationDto,
  UpdatePrinterStationDto,
} from './dto/printer-station.dto';
import { PrintJobsService } from './print-jobs.service';

@Injectable()
export class PrinterStationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly printJobsService: PrintJobsService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async findForBranch(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const printerStations = await this.prisma.printerStation.findMany({
      where: { branchId },
      orderBy: [{ station: 'asc' }, { name: 'asc' }],
    });

    return {
      branch,
      printerStations,
    };
  }

  async create(branchId: string, body: CreatePrinterStationDto) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { id: true, companyId: true },
      });

      if (!branch) {
        throw new NotFoundException('Branch not found');
      }

      const station = this.normalizeStation(body.station);

      if (body.isDefault) {
        await this.clearDefaultForStation(branch.id, station, tx);
      }

      const printerStation = await tx.printerStation.create({
        data: {
          companyId: branch.companyId,
          branchId: branch.id,
          name: body.name.trim(),
          slug: this.normalizeSlug(body.slug),
          station,
          adapterType: (body.adapterType ?? 'mock') as PrinterAdapterType,
          status: (body.status ?? 'active') as PrinterStationStatus,
          isDefault: body.isDefault ?? false,
          config: this.safeConfig(body.config),
        },
      });

      await this.realtimeEventsService.recordPrinterStationUpdated(
        printerStation.id,
        tx,
      );

      return { printerStation };
    });
  }

  async update(printerStationId: string, body: UpdatePrinterStationDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.printerStation.findUnique({
        where: { id: printerStationId },
        select: { id: true, branchId: true, station: true },
      });

      if (!current) {
        throw new NotFoundException('Printer station not found');
      }

      const station =
        body.station === undefined
          ? current.station
          : this.normalizeStation(body.station);

      if (body.isDefault) {
        await this.clearDefaultForStation(current.branchId, station, tx);
      }

      const printerStation = await tx.printerStation.update({
        where: { id: current.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.slug !== undefined
            ? { slug: this.normalizeSlug(body.slug) }
            : {}),
          ...(body.station !== undefined ? { station } : {}),
          ...(body.adapterType !== undefined
            ? { adapterType: body.adapterType as PrinterAdapterType }
            : {}),
          ...(body.status !== undefined
            ? { status: body.status as PrinterStationStatus }
            : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
          ...(body.config !== undefined ? { config: this.safeConfig(body.config) } : {}),
        },
      });

      await this.realtimeEventsService.recordPrinterStationUpdated(
        printerStation.id,
        tx,
      );

      return { printerStation };
    });
  }

  async disable(printerStationId: string) {
    const printerStation = await this.prisma.$transaction(async (tx) => {
      const updatedPrinterStation = await tx.printerStation.update({
        where: { id: printerStationId },
        data: {
          status: PrinterStationStatus.inactive,
          isDefault: false,
        },
      });

      await this.realtimeEventsService.recordPrinterStationUpdated(
        updatedPrinterStation.id,
        tx,
      );

      return updatedPrinterStation;
    });

    return { printerStation };
  }

  async testPrint(printerStationId: string, staffUserId: string) {
    return this.printJobsService.createTestPrintForStation(
      printerStationId,
      staffUserId,
    );
  }

  private async clearDefaultForStation(
    branchId: string,
    station: PreparationStation | null,
    tx: Prisma.TransactionClient,
  ) {
    await tx.printerStation.updateMany({
      where: {
        branchId,
        station,
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  private normalizeStation(value?: string | null) {
    return value ? (value as PreparationStation) : null;
  }

  private normalizeSlug(slug: string) {
    return slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  }

  private safeConfig(
    config?: Record<string, unknown> | null,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (!config) {
      return config === null ? Prisma.JsonNull : undefined;
    }

    const { password, token, apiKey, secret, ...safeConfig } = config;

    return JSON.parse(JSON.stringify(safeConfig)) as Prisma.InputJsonValue;
  }

  private branchSelect() {
    return {
      id: true,
      companyId: true,
      name: true,
      slug: true,
      address: true,
      status: true,
    };
  }
}
