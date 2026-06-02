import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsController } from './realtime-events.controller';
import { RealtimeEventsService } from './realtime-events.service';

@Module({
  imports: [PrismaModule],
  controllers: [RealtimeEventsController],
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeEventsModule {}
