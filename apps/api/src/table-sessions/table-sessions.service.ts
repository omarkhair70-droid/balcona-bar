import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PresenceTriggerType,
  Prisma,
  TableSessionEventType,
  TableSessionSource,
  TableSessionStatus,
} from '@prisma/client';
import { PresenceNotificationsService } from '../presence-notifications/presence-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { StartTableSessionDto } from './dto/start-table-session.dto';

const OPEN_SESSION_STATUSES: TableSessionStatus[] = [
  TableSessionStatus.active,
  TableSessionStatus.idle,
];

const sessionSelect = {
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
} satisfies Prisma.TableSessionSelect;

const tableSessionContextSelect = {
  ...sessionSelect,
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  },
  branch: {
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      status: true,
    },
  },
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

@Injectable()
export class TableSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async start(body: StartTableSessionDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const table = await tx.cafeTable.findUnique({
        where: { qrToken: body.qrToken },
        select: {
          id: true,
          branchId: true,
          status: true,
          branch: {
            select: {
              id: true,
              name: true,
              slug: true,
              address: true,
              status: true,
              companyId: true,
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

      if (table.status !== 'active') {
        throw new BadRequestException(
          `Table is not available for sessions because it is ${table.status}`,
        );
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${table.id})::bigint)`;

      const existingSession = await tx.tableSession.findFirst({
        where: {
          tableId: table.id,
          status: { in: OPEN_SESSION_STATUSES },
        },
        orderBy: { lastSeenAt: 'desc' },
        select: { id: true },
      });

      const now = new Date();

      if (existingSession) {
        const session = await tx.tableSession.update({
          where: { id: existingSession.id },
          data: {
            lastSeenAt: now,
            guestLabel: body.guestLabel,
            partySize: body.partySize,
          },
          select: tableSessionContextSelect,
        });

        await tx.tableSessionEvent.create({
          data: {
            tableSessionId: session.id,
            type: TableSessionEventType.resumed,
            metadata: { qrToken: body.qrToken },
          },
        });

        await this.presenceNotificationsService.recordQrTableSessionPresence(
          session,
          PresenceTriggerType.qr_session_resumed,
          tx,
        );

        await this.realtimeEventsService.recordTableSessionResumed(session, tx);

        return { session, wasResumed: true };
      }

      const session = await tx.tableSession.create({
        data: {
          companyId: table.branch.companyId,
          branchId: table.branchId,
          tableId: table.id,
          source: TableSessionSource.qr,
          guestLabel: body.guestLabel,
          partySize: body.partySize,
          lastSeenAt: now,
        },
        select: tableSessionContextSelect,
      });

      await tx.tableSessionEvent.create({
        data: {
          tableSessionId: session.id,
          type: TableSessionEventType.created,
          metadata: { qrToken: body.qrToken },
        },
      });

      await this.presenceNotificationsService.recordQrTableSessionPresence(
        session,
        PresenceTriggerType.qr_session_started,
        tx,
      );

      await this.realtimeEventsService.recordTableSessionStarted(session, tx);

      return { session, wasResumed: false };
    });

    return this.toContextResponse(result.session, result.wasResumed);
  }

  async findOne(sessionId: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: tableSessionContextSelect,
    });

    if (!session) {
      throw new NotFoundException('Table session not found');
    }

    return {
      ...this.toContextResponse(session),
      statusInfo: this.getStatusInfo(session),
    };
  }

  async view(sessionId: string) {
    await this.ensureSessionExists(sessionId);

    const now = new Date();
    const session = await this.prisma.$transaction(async (tx) => {
      const updatedSession = await tx.tableSession.update({
        where: { id: sessionId },
        data: { lastSeenAt: now },
        select: sessionSelect,
      });

      await tx.tableSessionEvent.create({
        data: {
          tableSessionId: sessionId,
          type: TableSessionEventType.viewed,
        },
      });

      return updatedSession;
    });

    return { session };
  }

  async close(sessionId: string, reason?: string) {
    await this.ensureSessionExists(sessionId);

    const now = new Date();
    const session = await this.prisma.$transaction(async (tx) => {
      const closedSession = await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          status: TableSessionStatus.closed,
          closedAt: now,
          closeReason: reason,
          lastSeenAt: now,
        },
        select: sessionSelect,
      });

      await tx.tableSessionEvent.create({
        data: {
          tableSessionId: sessionId,
          type: TableSessionEventType.closed,
          metadata: reason ? { reason } : undefined,
        },
      });

      return closedSession;
    });

    return { session };
  }

  async findActiveForBranch(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        tableSessions: {
          where: { status: { in: OPEN_SESSION_STATUSES } },
          orderBy: [{ lastSeenAt: 'desc' }, { startedAt: 'desc' }],
          select: {
            ...sessionSelect,
            table: {
              select: {
                id: true,
                code: true,
                displayName: true,
                capacity: true,
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
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async ensureSessionExists(sessionId: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundException('Table session not found');
    }
  }

  private toContextResponse(
    session: Prisma.TableSessionGetPayload<{
      select: typeof tableSessionContextSelect;
    }>,
    wasResumed?: boolean,
  ) {
    const { company, branch, table, ...sessionFields } = session;
    const { floor, ...tableFields } = table;

    return {
      session: sessionFields,
      company,
      branch,
      floor,
      table: tableFields,
      ...(wasResumed === undefined ? {} : { wasResumed }),
    };
  }

  private getStatusInfo(
    session: Prisma.TableSessionGetPayload<{
      select: typeof tableSessionContextSelect;
    }>,
  ) {
    return {
      isOpen: OPEN_SESSION_STATUSES.includes(session.status),
      isClosed: session.status === TableSessionStatus.closed,
      isExpired: session.status === TableSessionStatus.expired,
      lastSeenAt: session.lastSeenAt,
      closedAt: session.closedAt,
      expiresAt: session.expiresAt,
    };
  }
}
