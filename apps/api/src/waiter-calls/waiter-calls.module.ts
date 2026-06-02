import { Module } from '@nestjs/common';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { WaiterCallsController } from './waiter-calls.controller';
import { WaiterCallsService } from './waiter-calls.service';

@Module({
  imports: [PrismaModule, PresenceNotificationsModule, RealtimeEventsModule],
  controllers: [WaiterCallsController],
  providers: [WaiterCallsService],
})
export class WaiterCallsModule {}
