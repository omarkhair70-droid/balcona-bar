import { Module } from '@nestjs/common';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { TableSessionAccessService } from './table-session-access.service';
import { TableSessionsController } from './table-sessions.controller';
import { TableSessionsService } from './table-sessions.service';

@Module({
  imports: [PrismaModule, PresenceNotificationsModule, RealtimeEventsModule],
  controllers: [TableSessionsController],
  providers: [TableSessionsService, TableSessionAccessService],
  exports: [TableSessionsService, TableSessionAccessService],
})
export class TableSessionsModule {}
