import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffAccessService } from './staff-access.service';
import { StaffController } from './staff.controller';
import { StaffPermissionGuard } from './staff-permission.guard';
import { StaffScopedAccessService } from './staff-scoped-access.service';
import { StaffService } from './staff.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffController],
  providers: [
    StaffService,
    StaffAccessService,
    StaffPermissionGuard,
    StaffScopedAccessService,
  ],
  exports: [
    StaffService,
    StaffAccessService,
    StaffPermissionGuard,
    StaffScopedAccessService,
  ],
})
export class StaffModule {}
