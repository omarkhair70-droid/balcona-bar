import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AiWaiterSessionStatus,
  AuditAction,
  AuditActorType,
  BillRequestStatus,
  OrderStatus,
  PreparationTaskStatus,
  Prisma,
  RealtimeEventChannel,
  RealtimeEventType,
  TableAttentionPriority,
  TableAttentionReason,
  TableAttentionStatus,
  TableSessionStatus,
  WaiterCallStatus,
} from '@prisma/client';
import Redis from 'ioredis';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { AttentionQueryDto } from './dto/attention-query.dto';
import { MuteAttentionDto } from './dto/mute-attention.dto';
import { RecalculateAttentionDto } from './dto/recalculate-attention.dto';
import { ResolveAttentionDto } from './dto/resolve-attention.dto';

const DEFAULT_ATTENTION_LIMIT = 50;
const REDIS_TIMEOUT_MS = 250;
const ORDER_ACCEPTANCE_DELAY_MS = 5 * 60 * 1000;
const PREPARATION_DELAY_MS = 15 * 60 * 1000;
const READY_NOT_SERVED_DELAY_MS = 10 * 60 * 1000;
const IDLE_SESSION_DELAY_MS = 30 * 60 * 1000;

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

interface AttentionReasonRecord {
  reason: TableAttentionReason;
  scoreDelta: number;
  message: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class TableAttentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeEventsService: RealtimeEventsService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async listBranchAttention(branchId: string, query: AttentionQueryDto = {}) {
    const branch = await this.findBranchOrThrow(branchId);
    const snapshots = await this.prisma.tableAttentionSnapshot.findMany({
      where: {
        branchId,
        ...this.attentionFilters(query),
      },
      orderBy: [
        { score: 'desc' },
        { lastEvaluatedAt: 'desc' },
        { id: 'desc' },
      ],
      take: this.normalizeLimit(query.limit),
      include: this.snapshotInclude(),
    });

    return {
      branch,
      filters: {
        status: query.status ?? 'active',
        priority: query.priority ?? 'all',
        limit: this.normalizeLimit(query.limit),
      },
      attentionQueue: snapshots.map((snapshot) =>
        this.toSnapshotResponse(snapshot),
      ),
    };
  }

  async getTableSessionAttention(sessionId: string) {
    const session = await this.findTableSessionOrThrow(sessionId, this.prisma);
    const existing = await this.prisma.tableAttentionSnapshot.findUnique({
      where: { tableSessionId: sessionId },
      include: this.snapshotInclude(),
    });

    if (existing) {
      return {
        tableSession: this.toTableSessionResponse(session),
        attention: this.toSnapshotResponse(existing),
      };
    }

    return this.recalculateForTableSession(sessionId);
  }

  async recalculateForTableSession(
    sessionId: string,
    tx: PrismaExecutor = this.prisma,
    body: RecalculateAttentionDto = {},
  ) {
    const session = await this.findTableSessionOrThrow(sessionId, tx);
    const previous = await tx.tableAttentionSnapshot.findUnique({
      where: { tableSessionId: sessionId },
    });
    const score = await this.scoreTableSession(session, previous, tx);
    const priority = this.priorityForScore(score.total);
    const status = this.statusForScore(score.total, previous);
    const recommendedActions = this.recommendedActions(score.reasons);
    const now = new Date();
    const source = body.source ?? 'autopilot';
    const changed = this.snapshotChanged(previous, {
      status,
      priority,
      score: score.total,
      reasons: score.reasons,
      recommendedActions,
    });
    const snapshot = await tx.tableAttentionSnapshot.upsert({
      where: { tableSessionId: session.id },
      create: {
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.id,
        status,
        priority,
        score: score.total,
        reasons: this.toJson(score.reasons),
        recommendedActions: this.toJson(recommendedActions),
        source,
        lastEvaluatedAt: now,
        mutedUntil:
          status === TableAttentionStatus.muted ? previous?.mutedUntil : null,
        metadata:
          body.metadata === undefined ? undefined : this.toJson(body.metadata),
      },
      update: {
        status,
        priority,
        score: score.total,
        reasons: this.toJson(score.reasons),
        recommendedActions: this.toJson(recommendedActions),
        source,
        lastEvaluatedAt: now,
        resolvedAt: null,
        mutedUntil:
          status === TableAttentionStatus.muted ? previous?.mutedUntil : null,
        metadata:
          body.metadata === undefined ? undefined : this.toJson(body.metadata),
      },
      include: this.snapshotInclude(),
    });

    if (changed) {
      await this.recordReasonEvents(session, snapshot.id, score.reasons, tx);
    }

    await this.writeRedisState(snapshot);
    await this.recordAttentionRealtimeEvent(
      session,
      RealtimeEventType.table_attention_updated,
      this.snapshotRealtimePayload(snapshot),
      tx,
    );
    await this.recordBranchQueueRealtimeEvent(session, tx);
    await this.auditService.recordAuditLog(
      {
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.id,
        actorType: AuditActorType.system,
        targetType: 'table_attention_snapshot',
        targetId: snapshot.id,
        action: AuditAction.attention_recalculated,
        before: previous,
        after: snapshot,
      },
      tx,
    );

    return {
      tableSession: this.toTableSessionResponse(session),
      attention: this.toSnapshotResponse(snapshot),
    };
  }

  async rebuildBranchAttention(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId);
    const sessions = await this.prisma.tableSession.findMany({
      where: {
        branchId,
        status: {
          in: [TableSessionStatus.active, TableSessionStatus.idle],
        },
      },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    const attentionQueue: unknown[] = [];

    for (const session of sessions) {
      const result = await this.recalculateForTableSession(
        session.id,
        this.prisma,
        {
          source: 'branch_attention_rebuild',
        },
      );

      attentionQueue.push(result.attention);
    }

    await this.auditService.recordAuditLog({
      companyId: branch.companyId,
      branchId: branch.id,
      actorType: AuditActorType.system,
      targetType: 'branch_attention_queue',
      targetId: branch.id,
      action: AuditAction.attention_rebuilt,
      metadata: { sessionCount: sessions.length },
    });
    await this.recordBranchQueueRealtimeEvent(branch, this.prisma);

    return {
      branch,
      rebuiltSessions: sessions.length,
      attentionQueue,
    };
  }

  async resolveTableSession(sessionId: string, body: ResolveAttentionDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.findTableSessionOrThrow(sessionId, tx);
      const previous = await tx.tableAttentionSnapshot.findUnique({
        where: { tableSessionId: sessionId },
      });
      const note = this.normalizeOptionalText(body.note);
      const snapshot = await tx.tableAttentionSnapshot.upsert({
        where: { tableSessionId: session.id },
        create: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.id,
          status: TableAttentionStatus.resolved,
          priority: TableAttentionPriority.low,
          score: 0,
          reasons: this.toJson([]),
          recommendedActions: this.toJson([]),
          source: 'manual_resolution',
          lastEvaluatedAt: new Date(),
          resolvedAt: new Date(),
          metadata: note ? this.toJson({ note }) : undefined,
        },
        update: {
          status: TableAttentionStatus.resolved,
          priority: TableAttentionPriority.low,
          score: 0,
          reasons: this.toJson([]),
          recommendedActions: this.toJson([]),
          source: 'manual_resolution',
          lastEvaluatedAt: new Date(),
          resolvedAt: new Date(),
          mutedUntil: null,
          metadata: note ? this.toJson({ note }) : undefined,
        },
        include: this.snapshotInclude(),
      });

      await this.recordManualEvent(
        session,
        snapshot.id,
        TableAttentionReason.manual_flag,
        TableAttentionPriority.low,
        0,
        note ?? 'Attention resolved',
        tx,
      );
      await this.writeRedisState(snapshot);
      await this.recordAttentionRealtimeEvent(
        session,
        RealtimeEventType.table_attention_resolved,
        this.snapshotRealtimePayload(snapshot),
        tx,
      );
      await this.recordBranchQueueRealtimeEvent(session, tx);
      await this.auditService.recordAuditLog(
        {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.id,
          actorType: body.staffUserId
            ? AuditActorType.staff
            : AuditActorType.system,
          actorStaffUserId: body.staffUserId,
          targetType: 'table_attention_snapshot',
          targetId: snapshot.id,
          action: AuditAction.attention_resolved,
          before: previous,
          after: snapshot,
          metadata: note ? { note } : undefined,
        },
        tx,
      );

      return {
        tableSession: this.toTableSessionResponse(session),
        attention: this.toSnapshotResponse(snapshot),
      };
    });
  }

  async muteTableSession(sessionId: string, body: MuteAttentionDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.findTableSessionOrThrow(sessionId, tx);
      const previous = await tx.tableAttentionSnapshot.findUnique({
        where: { tableSessionId: sessionId },
      });
      const note = this.normalizeOptionalText(body.note);
      const mutedUntil = new Date(
        Date.now() + (body.minutes ?? 30) * 60 * 1000,
      );
      const snapshot = await tx.tableAttentionSnapshot.upsert({
        where: { tableSessionId: session.id },
        create: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.id,
          status: TableAttentionStatus.muted,
          priority: previous?.priority ?? TableAttentionPriority.low,
          score: previous?.score ?? 0,
          reasons: previous?.reasons ?? this.toJson([]),
          recommendedActions: previous?.recommendedActions ?? this.toJson([]),
          source: 'manual_mute',
          lastEvaluatedAt: new Date(),
          mutedUntil,
          metadata: this.toJson({ minutes: body.minutes ?? 30, note }),
        },
        update: {
          status: TableAttentionStatus.muted,
          source: 'manual_mute',
          lastEvaluatedAt: new Date(),
          mutedUntil,
          metadata: this.toJson({ minutes: body.minutes ?? 30, note }),
        },
        include: this.snapshotInclude(),
      });

      await this.recordManualEvent(
        session,
        snapshot.id,
        TableAttentionReason.manual_flag,
        snapshot.priority,
        0,
        note ?? 'Attention muted',
        tx,
      );
      await this.writeRedisState(snapshot);
      await this.recordAttentionRealtimeEvent(
        session,
        RealtimeEventType.table_attention_updated,
        this.snapshotRealtimePayload(snapshot),
        tx,
      );
      await this.recordBranchQueueRealtimeEvent(session, tx);
      await this.auditService.recordAuditLog(
        {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.id,
          actorType: body.staffUserId
            ? AuditActorType.staff
            : AuditActorType.system,
          actorStaffUserId: body.staffUserId,
          targetType: 'table_attention_snapshot',
          targetId: snapshot.id,
          action: AuditAction.attention_muted,
          before: previous,
          after: snapshot,
          metadata: { mutedUntil, note },
        },
        tx,
      );

      return {
        tableSession: this.toTableSessionResponse(session),
        attention: this.toSnapshotResponse(snapshot),
      };
    });
  }

  private async scoreTableSession(
    session: Awaited<ReturnType<TableAttentionService['findTableSessionOrThrow']>>,
    previous: { mutedUntil: Date | null } | null,
    tx: PrismaExecutor,
  ) {
    if (previous?.mutedUntil && previous.mutedUntil > new Date()) {
      return { total: 0, reasons: [] as AttentionReasonRecord[] };
    }

    const now = Date.now();
    const [
      waitingOrders,
      preparingTasks,
      readyOrders,
      activeWaiterCalls,
      activeBillRequests,
      escalatedAiWaiterSessions,
    ] = await Promise.all([
      tx.order.findMany({
        where: {
          tableSessionId: session.id,
          status: OrderStatus.submitted,
          submittedAt: { lte: new Date(now - ORDER_ACCEPTANCE_DELAY_MS) },
        },
        select: { id: true, orderNumber: true, submittedAt: true },
      }),
      tx.preparationTask.findMany({
        where: {
          status: PreparationTaskStatus.preparing,
          startedAt: { lte: new Date(now - PREPARATION_DELAY_MS) },
          order: { tableSessionId: session.id },
        },
        select: {
          id: true,
          orderId: true,
          itemNameSnapshot: true,
          startedAt: true,
        },
      }),
      tx.order.findMany({
        where: {
          tableSessionId: session.id,
          status: OrderStatus.ready,
          readyAt: { lte: new Date(now - READY_NOT_SERVED_DELAY_MS) },
        },
        select: { id: true, orderNumber: true, readyAt: true },
      }),
      tx.waiterCall.findMany({
        where: {
          tableSessionId: session.id,
          status: {
            in: [WaiterCallStatus.open, WaiterCallStatus.acknowledged],
          },
        },
        select: { id: true, status: true, priority: true, createdAt: true },
      }),
      tx.billRequest.findMany({
        where: {
          tableSessionId: session.id,
          status: {
            in: [
              BillRequestStatus.open,
              BillRequestStatus.acknowledged,
              BillRequestStatus.presented,
            ],
          },
        },
        select: { id: true, status: true, requestedAt: true },
      }),
      tx.aiWaiterSession.findMany({
        where: {
          tableSessionId: session.id,
          status: AiWaiterSessionStatus.escalated,
        },
        select: { id: true, escalatedAt: true, escalationReason: true },
      }),
    ]);
    const reasons: AttentionReasonRecord[] = [];

    if (waitingOrders.length > 0) {
      reasons.push({
        reason: TableAttentionReason.order_waiting_for_acceptance,
        scoreDelta: 30,
        message: 'Submitted order has waited for cashier acceptance.',
        metadata: {
          orderCount: waitingOrders.length,
          orderIds: waitingOrders.map((order) => order.id),
        },
      });
    }

    if (preparingTasks.length > 0) {
      reasons.push({
        reason: TableAttentionReason.preparation_delayed,
        scoreDelta: 25,
        message: 'Preparation task has been in progress longer than expected.',
        metadata: {
          taskCount: preparingTasks.length,
          taskIds: preparingTasks.map((task) => task.id),
        },
      });
    }

    if (readyOrders.length > 0) {
      reasons.push({
        reason: TableAttentionReason.order_ready_not_served,
        scoreDelta: 35,
        message: 'Ready order is waiting to be served.',
        metadata: {
          orderCount: readyOrders.length,
          orderIds: readyOrders.map((order) => order.id),
        },
      });
    }

    if (activeWaiterCalls.length > 0) {
      reasons.push({
        reason: TableAttentionReason.waiter_call_open,
        scoreDelta: 40,
        message: 'Table has an active waiter call.',
        metadata: {
          waiterCallCount: activeWaiterCalls.length,
          waiterCallIds: activeWaiterCalls.map((call) => call.id),
        },
      });
    }

    if (activeBillRequests.length > 0) {
      reasons.push({
        reason: TableAttentionReason.bill_requested,
        scoreDelta: 30,
        message: 'Table has an active bill request.',
        metadata: {
          billRequestCount: activeBillRequests.length,
          billRequestIds: activeBillRequests.map((bill) => bill.id),
        },
      });
    }

    if (escalatedAiWaiterSessions.length > 0) {
      reasons.push({
        reason: TableAttentionReason.ai_waiter_escalated,
        scoreDelta: 35,
        message: 'AI waiter escalated this session to staff.',
        metadata: {
          aiWaiterSessionCount: escalatedAiWaiterSessions.length,
          aiWaiterSessionIds: escalatedAiWaiterSessions.map(
            (aiSession) => aiSession.id,
          ),
        },
      });
    }

    if (
      (session.status === TableSessionStatus.active ||
        session.status === TableSessionStatus.idle) &&
      session.lastSeenAt.getTime() <= now - IDLE_SESSION_DELAY_MS
    ) {
      reasons.push({
        reason: TableAttentionReason.session_idle_too_long,
        scoreDelta: 10,
        message: 'Table session has been idle longer than expected.',
        metadata: {
          lastSeenAt: session.lastSeenAt,
        },
      });
    }

    return {
      total: reasons.reduce((sum, reason) => sum + reason.scoreDelta, 0),
      reasons,
    };
  }

  private attentionFilters(query: AttentionQueryDto) {
    const where: Prisma.TableAttentionSnapshotWhereInput = {};

    if (!query.status) {
      where.status = {
        in: [
          TableAttentionStatus.needs_attention,
          TableAttentionStatus.urgent,
          TableAttentionStatus.muted,
        ],
      };
    } else if (query.status !== 'all') {
      where.status = query.status as TableAttentionStatus;
    }

    if (query.priority && query.priority !== 'all') {
      where.priority = query.priority as TableAttentionPriority;
    }

    return where;
  }

  private priorityForScore(score: number) {
    if (score >= 70) {
      return TableAttentionPriority.urgent;
    }

    if (score >= 40) {
      return TableAttentionPriority.high;
    }

    if (score >= 20) {
      return TableAttentionPriority.medium;
    }

    return TableAttentionPriority.low;
  }

  private statusForScore(
    score: number,
    previous: { mutedUntil: Date | null } | null,
  ) {
    if (previous?.mutedUntil && previous.mutedUntil > new Date()) {
      return TableAttentionStatus.muted;
    }

    if (score === 0) {
      return TableAttentionStatus.normal;
    }

    return score >= 70
      ? TableAttentionStatus.urgent
      : TableAttentionStatus.needs_attention;
  }

  private recommendedActions(reasons: AttentionReasonRecord[]) {
    const actions = new Set<string>();

    for (const reason of reasons) {
      switch (reason.reason) {
        case TableAttentionReason.order_waiting_for_acceptance:
          actions.add('review_order');
          break;
        case TableAttentionReason.preparation_delayed:
          actions.add('check_preparation');
          break;
        case TableAttentionReason.order_ready_not_served:
          actions.add('serve_order');
          break;
        case TableAttentionReason.waiter_call_open:
          actions.add('send_waiter');
          break;
        case TableAttentionReason.bill_requested:
          actions.add('present_bill');
          break;
        case TableAttentionReason.ai_waiter_escalated:
          actions.add('check_table');
          break;
        default:
          actions.add('resolve_attention');
          break;
      }
    }

    if (actions.size > 0) {
      actions.add('resolve_attention');
    }

    return Array.from(actions);
  }

  private snapshotChanged(
    previous: { status: string; priority: string; score: number; reasons: Prisma.JsonValue; recommendedActions: Prisma.JsonValue | null } | null,
    next: {
      status: TableAttentionStatus;
      priority: TableAttentionPriority;
      score: number;
      reasons: AttentionReasonRecord[];
      recommendedActions: string[];
    },
  ) {
    if (!previous) {
      return true;
    }

    return (
      previous.status !== next.status ||
      previous.priority !== next.priority ||
      previous.score !== next.score ||
      JSON.stringify(previous.reasons) !== JSON.stringify(next.reasons) ||
      JSON.stringify(previous.recommendedActions ?? []) !==
        JSON.stringify(next.recommendedActions)
    );
  }

  private async recordReasonEvents(
    session: { companyId: string; branchId: string; id: string },
    snapshotId: string,
    reasons: AttentionReasonRecord[],
    tx: PrismaExecutor,
  ) {
    if (reasons.length === 0) {
      return;
    }

    await tx.tableAttentionEvent.createMany({
      data: reasons.map((reason) => ({
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.id,
        snapshotId,
        reason: reason.reason,
        priority: this.priorityForScore(reason.scoreDelta),
        scoreDelta: reason.scoreDelta,
        message: reason.message,
        metadata:
          reason.metadata === undefined ? undefined : this.toJson(reason.metadata),
      })),
    });
  }

  private async recordManualEvent(
    session: { companyId: string; branchId: string; id: string },
    snapshotId: string,
    reason: TableAttentionReason,
    priority: TableAttentionPriority,
    scoreDelta: number,
    message: string,
    tx: PrismaExecutor,
  ) {
    await tx.tableAttentionEvent.create({
      data: {
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.id,
        snapshotId,
        reason,
        priority,
        scoreDelta,
        message,
      },
    });
  }

  private async recordAttentionRealtimeEvent(
    session: { companyId: string; branchId: string; id?: string },
    type: RealtimeEventType,
    payload: Record<string, unknown>,
    tx: PrismaExecutor,
  ) {
    try {
      await this.realtimeEventsService.createRealtimeEvent(
        {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.id,
          type,
          channel: RealtimeEventChannel.session_status,
          payload,
        },
        tx,
      );
    } catch {
      return undefined;
    }
  }

  private async recordBranchQueueRealtimeEvent(
    scope: { companyId: string; id?: string; branchId?: string },
    tx: PrismaExecutor,
  ) {
    const branchId = scope.branchId ?? scope.id;

    if (!branchId) {
      return;
    }

    try {
      await this.realtimeEventsService.createRealtimeEvent(
        {
          companyId: scope.companyId,
          branchId,
          type: RealtimeEventType.branch_attention_queue_updated,
          channel: RealtimeEventChannel.branch_notifications,
          payload: {
            branchId,
          },
        },
        tx,
      );
    } catch {
      return undefined;
    }
  }

  private async writeRedisState(snapshot: {
    branchId: string;
    tableSessionId: string;
    status: TableAttentionStatus;
    priority: TableAttentionPriority;
    score: number;
    reasons: Prisma.JsonValue;
    recommendedActions: Prisma.JsonValue | null;
    lastEvaluatedAt: Date;
    mutedUntil: Date | null;
  }) {
    await this.safeRedis(async () => {
      const payload = JSON.stringify({
        status: snapshot.status,
        priority: snapshot.priority,
        score: snapshot.score,
        reasons: snapshot.reasons,
        recommendedActions: snapshot.recommendedActions,
        lastEvaluatedAt: snapshot.lastEvaluatedAt,
        mutedUntil: snapshot.mutedUntil,
      });
      const stateKey = `table_session:${snapshot.tableSessionId}:attention_state`;
      const scoreKey = `table_session:${snapshot.tableSessionId}:attention_score`;
      const queueKey = `branch:${snapshot.branchId}:attention_queue`;
      const sessionsKey = `branch:${snapshot.branchId}:active_sessions`;

      await this.redisClient.set(stateKey, payload, 'EX', 60 * 60);
      await this.redisClient.set(scoreKey, String(snapshot.score), 'EX', 60 * 60);
      await this.redisClient.sadd(sessionsKey, snapshot.tableSessionId);

      if (
        snapshot.status === TableAttentionStatus.normal ||
        snapshot.status === TableAttentionStatus.resolved
      ) {
        await this.redisClient.zrem(queueKey, snapshot.tableSessionId);
      } else {
        await this.redisClient.zadd(
          queueKey,
          snapshot.score,
          snapshot.tableSessionId,
        );
      }
    });
  }

  private async safeRedis(operation: () => Promise<unknown>) {
    try {
      await Promise.race([
        operation(),
        new Promise((resolve) => setTimeout(resolve, REDIS_TIMEOUT_MS)),
      ]);
    } catch {
      return undefined;
    }
  }

  private snapshotRealtimePayload(snapshot: {
    id: string;
    tableSessionId: string;
    status: TableAttentionStatus;
    priority: TableAttentionPriority;
    score: number;
    reasons: Prisma.JsonValue;
    recommendedActions: Prisma.JsonValue | null;
    mutedUntil: Date | null;
    resolvedAt: Date | null;
  }) {
    return {
      attentionSnapshotId: snapshot.id,
      tableSessionId: snapshot.tableSessionId,
      status: snapshot.status,
      priority: snapshot.priority,
      score: snapshot.score,
      reasons: snapshot.reasons,
      recommendedActions: snapshot.recommendedActions,
      mutedUntil: snapshot.mutedUntil,
      resolvedAt: snapshot.resolvedAt,
    };
  }

  private async findBranchOrThrow(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async findTableSessionOrThrow(
    sessionId: string,
    tx: PrismaExecutor,
  ) {
    const session = await tx.tableSession.findUnique({
      where: { id: sessionId },
      select: this.tableSessionSelect(),
    });

    if (!session) {
      throw new NotFoundException('Table session not found');
    }

    return session;
  }

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? DEFAULT_ATTENTION_LIMIT, 1), 100);
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private toSnapshotResponse(snapshot: any) {
    const { tableSession, ...attention } = snapshot;

    return {
      attention,
      tableSession: tableSession
        ? this.toTableSessionResponse(tableSession)
        : undefined,
    };
  }

  private toTableSessionResponse(tableSession: any) {
    if (!tableSession.table) {
      return tableSession;
    }

    const { table, ...sessionFields } = tableSession;
    const { floor, ...tableFields } = table;

    return {
      ...sessionFields,
      floor,
      table: tableFields,
    };
  }

  private snapshotInclude() {
    return {
      tableSession: {
        select: this.tableSessionSelect(),
      },
    } satisfies Prisma.TableAttentionSnapshotInclude;
  }

  private tableSessionSelect() {
    return {
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
      table: {
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
        },
      },
    } satisfies Prisma.TableSessionSelect;
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
