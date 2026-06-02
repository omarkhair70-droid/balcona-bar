import { Module } from '@nestjs/common';
import { PresenceNotificationsModule } from '../presence-notifications/presence-notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PreparationTasksController } from './preparation-tasks.controller';
import { PreparationTasksService } from './preparation-tasks.service';

@Module({
  imports: [PrismaModule, PresenceNotificationsModule],
  controllers: [PreparationTasksController],
  providers: [PreparationTasksService],
  exports: [PreparationTasksService],
})
export class PreparationTasksModule {}
