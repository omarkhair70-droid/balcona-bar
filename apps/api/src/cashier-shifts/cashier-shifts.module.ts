import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffModule } from '../staff/staff.module';
import { CashierShiftsController } from './cashier-shifts.controller';
import { CashierShiftsService } from './cashier-shifts.service';

@Module({
  imports: [PrismaModule, StaffModule],
  controllers: [CashierShiftsController],
  providers: [CashierShiftsService],
  exports: [CashierShiftsService],
})
export class CashierShiftsModule {}
