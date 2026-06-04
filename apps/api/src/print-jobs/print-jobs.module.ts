import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeEventsModule } from '../realtime-events/realtime-events.module';
import { StaffModule } from '../staff/staff.module';
import { PrinterStationsController } from './printer-stations.controller';
import { PrinterStationsService } from './printer-stations.service';
import { PrintJobsController } from './print-jobs.controller';
import { PrintJobsService } from './print-jobs.service';

@Module({
  imports: [PrismaModule, RealtimeEventsModule, StaffModule],
  controllers: [PrintJobsController, PrinterStationsController],
  providers: [PrintJobsService, PrinterStationsService],
  exports: [PrintJobsService, PrinterStationsService],
})
export class PrintJobsModule {}
