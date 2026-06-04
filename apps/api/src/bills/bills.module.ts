import { Module } from '@nestjs/common';
import { AutopilotModule } from '../autopilot/autopilot.module';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { StaffModule } from '../staff/staff.module';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';

@Module({
  imports: [
    PrismaModule,
    AutopilotModule,
    PresenceNotificationsModule,
    RealtimeEventsModule,
    StaffModule,
  ],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
