import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PreparationTasksModule } from '../preparation-tasks/preparation-tasks.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    PrismaModule,
    CartModule,
    PreparationTasksModule,
    PresenceNotificationsModule,
    RealtimeEventsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
