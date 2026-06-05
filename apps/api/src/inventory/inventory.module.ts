import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasModule } from '../saas/saas.module';
import { StaffModule } from '../staff/staff.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PrismaModule, SaasModule, StaffModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
