import { Module } from '@nestjs/common';
import { AutopilotModule } from '../autopilot/autopilot.module';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { StaffModule } from '../staff/staff.module';
import { BillRequestsController } from './bill-requests.controller';
import { BillRequestsService } from './bill-requests.service';

@Module({
  imports: [
    PrismaModule,
    AutopilotModule,
    PresenceNotificationsModule,
    RealtimeEventsModule,
    StaffModule,
  ],
  controllers: [BillRequestsController],
  providers: [BillRequestsService],
})
export class BillRequestsModule {}
