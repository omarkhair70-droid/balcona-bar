import { BadRequestException } from '@nestjs/common';
import {
  BranchStatus,
  CompanyStatus,
  PresenceTriggerType,
  TableSessionStatus,
  TableStatus,
} from '@prisma/client';
import { PresenceNotificationsService } from '../presence-notifications/presence-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { TableSessionAccessService } from './table-session-access.service';
import { TableSessionsService } from './table-sessions.service';

function createService(prisma: PrismaService) {
  return new TableSessionsService(
    prisma,
    {} as unknown as PresenceNotificationsService,
    {} as unknown as RealtimeEventsService,
    {} as unknown as TableSessionAccessService,
  );
}

describe('TableSessionsService', () => {
  it('rejects QR session starts for inactive branches', async () => {
    const prisma = {
      $transaction: jest.fn((callback) =>
        callback({
          cafeTable: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'table-1',
              branchId: 'branch-1',
              status: TableStatus.active,
              branch: {
                id: 'branch-1',
                name: 'Main Branch',
                slug: 'main',
                address: null,
                status: BranchStatus.inactive,
                companyId: 'company-1',
                company: {
                  id: 'company-1',
                  name: 'Demo Cafe',
                  slug: 'demo-cafe',
                  status: CompanyStatus.active,
                },
              },
            }),
          },
        }),
      ),
    } as unknown as PrismaService;
    const service = createService(prisma);

    await expect(
      service.start({
        qrToken: 'main-t01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns a committed QR session before slow presence/realtime side effects finish', async () => {
    const session = {
      id: 'session-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      tableId: 'table-1',
      status: TableSessionStatus.active,
      source: 'qr',
      guestLabel: null,
      partySize: null,
      startedAt: new Date(),
      lastSeenAt: new Date(),
      expiresAt: null,
      closedAt: null,
      closeReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      company: {
        id: 'company-1',
        name: 'Demo Cafe',
        slug: 'demo-cafe',
        status: CompanyStatus.active,
      },
      branch: {
        id: 'branch-1',
        name: 'Main Branch',
        slug: 'main',
        address: null,
        status: BranchStatus.active,
      },
      table: {
        id: 'table-1',
        code: 'T01',
        displayName: 'Table 1',
        capacity: 2,
        qrToken: 'main-t01',
        status: TableStatus.active,
        floor: {
          id: 'floor-1',
          name: 'Main Floor',
          sortOrder: 1,
        },
      },
    };

    const tx = {
      cafeTable: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'table-1',
          branchId: 'branch-1',
          status: TableStatus.active,
          branch: {
            id: 'branch-1',
            name: 'Main Branch',
            slug: 'main',
            address: null,
            status: BranchStatus.active,
            companyId: 'company-1',
            company: {
              id: 'company-1',
              name: 'Demo Cafe',
              slug: 'demo-cafe',
              status: CompanyStatus.active,
            },
          },
        }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      tableSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }),
        update: jest.fn().mockResolvedValue(session),
      },
      tableSessionEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;

    let finishPresence!: () => void;
    const presenceFinished = new Promise<void>((resolve) => {
      finishPresence = resolve;
    });
    const presenceNotificationsService = {
      recordQrTableSessionPresence: jest.fn(() => presenceFinished),
    } as unknown as PresenceNotificationsService;
    const realtimeEventsService = {
      recordTableSessionResumed: jest.fn().mockResolvedValue(undefined),
      recordTableSessionStarted: jest.fn().mockResolvedValue(undefined),
    } as unknown as RealtimeEventsService;
    const tableSessionAccessService = {
      issueAccessToken: jest.fn().mockResolvedValue({
        customerAccessToken: 'customer-token',
        customerAccessTokenExpiresAt: null,
        customerSessionIdentityId: 'identity-1',
      }),
    } as unknown as TableSessionAccessService;

    const service = new TableSessionsService(
      prisma,
      presenceNotificationsService,
      realtimeEventsService,
      tableSessionAccessService,
    );

    const result = await Promise.race([
      service.start({ qrToken: 'main-t01' }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('QR start waited for post-start side effects')),
          100,
        ),
      ),
    ]);

    expect(result.session.id).toBe('session-1');
    expect(result.wasResumed).toBe(true);
    expect(result.customerAccess.customerAccessToken).toBe('customer-token');
    expect(
      presenceNotificationsService.recordQrTableSessionPresence,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      PresenceTriggerType.qr_session_resumed,
    );
    expect(realtimeEventsService.recordTableSessionResumed).not.toHaveBeenCalled();

    finishPresence();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(realtimeEventsService.recordTableSessionResumed).toHaveBeenCalled();
  });
});
