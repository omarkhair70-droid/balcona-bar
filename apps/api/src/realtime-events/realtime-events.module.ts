import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffModule } from '../staff/staff.module';
import { RealtimeEventsController } from './realtime-events.controller';
import { RealtimeEventsService } from './realtime-events.service';

@Module({
  imports: [PrismaModule, StaffModule, forwardRef(() => StaffAuthModule)],
  controllers: [RealtimeEventsController],
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeEventsModule {}
