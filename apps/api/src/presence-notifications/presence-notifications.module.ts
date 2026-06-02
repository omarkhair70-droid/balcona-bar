import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { PresenceNotificationsController } from './presence-notifications.controller';
import { PresenceNotificationsService } from './presence-notifications.service';

@Module({
  imports: [PrismaModule, RealtimeEventsModule],
  controllers: [PresenceNotificationsController],
  providers: [PresenceNotificationsService],
  exports: [PresenceNotificationsService],
})
export class PresenceNotificationsModule {}
