import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PresenceNotificationsController } from './presence-notifications.controller';
import { PresenceNotificationsService } from './presence-notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [PresenceNotificationsController],
  providers: [PresenceNotificationsService],
  exports: [PresenceNotificationsService],
})
export class PresenceNotificationsModule {}
