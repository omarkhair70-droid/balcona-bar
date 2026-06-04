import { Module } from '@nestjs/common';
import { AutopilotModule } from '../autopilot/autopilot.module';
import { CartModule } from '../cart/cart.module';
import { KitchenTicketsModule } from '../kitchen-tickets/kitchen-tickets.module';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PreparationTasksModule } from '../preparation-tasks/preparation-tasks.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { SmartCashierModule } from '../smart-cashier/smart-cashier.module';
import { StaffModule } from '../staff/staff.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    PrismaModule,
    AutopilotModule,
    CartModule,
    KitchenTicketsModule,
    PreparationTasksModule,
    PresenceNotificationsModule,
    RealtimeEventsModule,
    SmartCashierModule,
    StaffModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
