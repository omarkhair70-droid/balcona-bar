import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrintJobsModule } from '../print-jobs/print-jobs.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { StaffModule } from '../staff/staff.module';
import { KitchenTicketsController } from './kitchen-tickets.controller';
import { KitchenTicketsService } from './kitchen-tickets.service';

@Module({
  imports: [PrismaModule, PrintJobsModule, RealtimeEventsModule, StaffModule],
  controllers: [KitchenTicketsController],
  providers: [KitchenTicketsService],
  exports: [KitchenTicketsService],
})
export class KitchenTicketsModule {}
