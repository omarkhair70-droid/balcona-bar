import { Module } from '@nestjs/common';
import { StaffModule } from '../staff/staff.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { TableSessionsModule } from '../table-sessions/table-sessions.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { AiWaiterJobsProcessor } from './processors/ai-waiter-jobs.processor';
import { AnalyticsJobsProcessor } from './processors/analytics-jobs.processor';
import { AttentionJobsProcessor } from './processors/attention-jobs.processor';
import { CleanupJobsProcessor } from './processors/cleanup-jobs.processor';
import { NotificationJobsProcessor } from './processors/notification-jobs.processor';

@Module({
  imports: [StaffModule, StaffAuthModule, TableSessionsModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    AiWaiterJobsProcessor,
    AnalyticsJobsProcessor,
    AttentionJobsProcessor,
    CleanupJobsProcessor,
    NotificationJobsProcessor,
  ],
  exports: [JobsService],
})
export class JobsModule {}

