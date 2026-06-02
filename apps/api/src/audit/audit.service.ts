import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  AuditActorType,
  Prisma,
  RealtimeEventChannel,
  RealtimeEventType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

export interface RecordAuditLogInput {
  companyId: string;
  branchId?: string | null;
  actorType: AuditActorType;
  actorStaffUserId?: string | null;
  tableSessionId?: string | null;
  targetType: string;
  targetId?: string | null;
  action: AuditAction;
  message?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  requestId?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async recordAuditLog(
    input: RecordAuditLogInput,
    tx: PrismaExecutor = this.prisma,
  ) {
    try {
      const auditLog = await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId ?? undefined,
          actorType: input.actorType,
          actorStaffUserId: input.actorStaffUserId ?? undefined,
          tableSessionId: input.tableSessionId ?? undefined,
          targetType: input.targetType,
          targetId: input.targetId ?? undefined,
          action: input.action,
          message: input.message ?? undefined,
          before:
            input.before === undefined ? undefined : this.toJson(input.before),
          after: input.after === undefined ? undefined : this.toJson(input.after),
          metadata:
            input.metadata === undefined
              ? undefined
              : this.toJson(input.metadata),
          requestId: input.requestId ?? undefined,
        },
      });

      await this.realtimeEventsService.createRealtimeEvent(
        {
          companyId: auditLog.companyId,
          branchId: auditLog.branchId,
          tableSessionId: auditLog.tableSessionId,
          type: RealtimeEventType.audit_log_created,
          channel: RealtimeEventChannel.system,
          payload: {
            auditLogId: auditLog.id,
            action: auditLog.action,
            actorType: auditLog.actorType,
            targetType: auditLog.targetType,
            targetId: auditLog.targetId,
          },
        },
        tx,
      );

      return auditLog;
    } catch {
      return null;
    }
  }

  async findForBranch(branchId: string, query: AuditLogQueryDto = {}) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        branchId,
        ...this.queryWhere(query),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: this.normalizeLimit(query.limit),
      include: this.auditLogInclude(),
    });

    return {
      branch,
      filters: this.filters(query),
      auditLogs,
    };
  }

  async findForCompany(companyId: string, query: AuditLogQueryDto = {}) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: this.companySelect(),
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        companyId,
        ...this.queryWhere(query),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: this.normalizeLimit(query.limit),
      include: this.auditLogInclude(),
    });

    return {
      company,
      filters: this.filters(query),
      auditLogs,
    };
  }

  private queryWhere(query: AuditLogQueryDto): Prisma.AuditLogWhereInput {
    return {
      ...(query.action ? { action: query.action as AuditAction } : {}),
      ...(query.actorType
        ? { actorType: query.actorType as AuditActorType }
        : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.tableSessionId ? { tableSessionId: query.tableSessionId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
  }

  private filters(query: AuditLogQueryDto) {
    return {
      action: query.action ?? 'all',
      actorType: query.actorType ?? 'all',
      targetType: query.targetType ?? 'all',
      tableSessionId: query.tableSessionId ?? 'all',
      from: query.from ?? null,
      to: query.to ?? null,
      limit: this.normalizeLimit(query.limit),
    };
  }

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? 100, 1), 200);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private auditLogInclude() {
    return {
      branch: { select: this.branchSelect() },
      actorStaffUser: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      },
      tableSession: {
        select: {
          id: true,
          status: true,
          tableId: true,
          guestLabel: true,
          partySize: true,
        },
      },
    } satisfies Prisma.AuditLogInclude;
  }

  private companySelect() {
    return {
      id: true,
      name: true,
      slug: true,
      status: true,
    };
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
