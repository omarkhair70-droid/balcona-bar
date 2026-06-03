import { BadRequestException } from '@nestjs/common';
import { BranchStatus, CompanyStatus, TableStatus } from '@prisma/client';
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
});
