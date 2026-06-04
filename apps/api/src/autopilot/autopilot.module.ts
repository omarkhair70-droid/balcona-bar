import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { StaffModule } from '../staff/staff.module';
import { AutopilotController } from './autopilot.controller';
import { TableAttentionService } from './table-attention.service';

@Module({
  imports: [PrismaModule, AuditModule, RealtimeEventsModule, StaffModule],
  controllers: [AutopilotController],
  providers: [TableAttentionService],
  exports: [TableAttentionService],
})
export class AutopilotModule {}

