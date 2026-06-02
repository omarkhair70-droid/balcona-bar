import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffAccessService } from './staff-access.service';
import { StaffController } from './staff.controller';
import { StaffPermissionGuard } from './staff-permission.guard';
import { StaffService } from './staff.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffController],
  providers: [StaffService, StaffAccessService, StaffPermissionGuard],
  exports: [StaffService, StaffAccessService, StaffPermissionGuard],
})
export class StaffModule {}
