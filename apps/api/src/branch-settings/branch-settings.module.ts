import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { BranchSettingsController } from './branch-settings.controller';
import { BranchSettingsService } from './branch-settings.service';

@Module({
  imports: [PrismaModule, AuditModule, RealtimeEventsModule],
  controllers: [BranchSettingsController],
  providers: [BranchSettingsService],
  exports: [BranchSettingsService],
})
export class BranchSettingsModule {}
