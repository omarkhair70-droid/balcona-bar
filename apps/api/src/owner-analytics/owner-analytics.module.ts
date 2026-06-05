import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffModule } from '../staff/staff.module';
import { OwnerAnalyticsController } from './owner-analytics.controller';
import { OwnerAnalyticsService } from './owner-analytics.service';

@Module({
  imports: [PrismaModule, StaffModule],
  controllers: [OwnerAnalyticsController],
  providers: [OwnerAnalyticsService],
})
export class OwnerAnalyticsModule {}
