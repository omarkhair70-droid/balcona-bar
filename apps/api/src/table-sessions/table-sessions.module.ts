import { Module } from '@nestjs/common';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { StaffModule } from '../staff/staff.module';
import { TableSessionAccessService } from './table-session-access.service';
import { CustomerSessionAccessGuard } from './guards/customer-session-access.guard';
import { TableSessionsController } from './table-sessions.controller';
import { TableSessionsService } from './table-sessions.service';

@Module({
  imports: [
    PrismaModule,
    PresenceNotificationsModule,
    RealtimeEventsModule,
    StaffModule,
  ],
  controllers: [TableSessionsController],
  providers: [
    TableSessionsService,
    TableSessionAccessService,
    CustomerSessionAccessGuard,
  ],
  exports: [
    TableSessionsService,
    TableSessionAccessService,
    CustomerSessionAccessGuard,
  ],
})
export class TableSessionsModule {}
