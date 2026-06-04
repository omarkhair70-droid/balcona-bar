import { Module } from '@nestjs/common';
import { AutopilotModule } from '../autopilot/autopilot.module';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { StaffModule } from '../staff/staff.module';
import { PreparationTasksController } from './preparation-tasks.controller';
import { PreparationTasksService } from './preparation-tasks.service';

@Module({
  imports: [
    PrismaModule,
    AutopilotModule,
    PresenceNotificationsModule,
    RealtimeEventsModule,
    StaffModule,
  ],
  controllers: [PreparationTasksController],
  providers: [PreparationTasksService],
  exports: [PreparationTasksService],
})
export class PreparationTasksModule {}
