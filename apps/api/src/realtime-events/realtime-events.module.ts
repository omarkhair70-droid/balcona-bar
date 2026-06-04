import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffModule } from '../staff/staff.module';
import { RealtimeEventsController } from './realtime-events.controller';
import { RealtimeEventsService } from './realtime-events.service';

@Module({
  imports: [PrismaModule, StaffModule],
  controllers: [RealtimeEventsController],
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeEventsModule {}
