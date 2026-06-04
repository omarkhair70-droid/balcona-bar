import { Module } from '@nestjs/common';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PreparationTasksModule } from '../preparation-tasks/preparation-tasks.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { StaffModule } from '../staff/staff.module';
import { SmartCashierController } from './smart-cashier.controller';
import { SmartCashierService } from './smart-cashier.service';

@Module({
  imports: [
    PrismaModule,
    PreparationTasksModule,
    PresenceNotificationsModule,
    RealtimeEventsModule,
    StaffModule,
  ],
  controllers: [SmartCashierController],
  providers: [SmartCashierService],
  exports: [SmartCashierService],
})
export class SmartCashierModule {}
