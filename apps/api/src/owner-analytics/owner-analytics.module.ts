import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasModule } from '../saas/saas.module';
import { StaffModule } from '../staff/staff.module';
import { OwnerAnalyticsController } from './owner-analytics.controller';
import { OwnerAnalyticsService } from './owner-analytics.service';

@Module({
  imports: [PrismaModule, InventoryModule, SaasModule, StaffModule],
  controllers: [OwnerAnalyticsController],
  providers: [OwnerAnalyticsService],
})
export class OwnerAnalyticsModule {}
