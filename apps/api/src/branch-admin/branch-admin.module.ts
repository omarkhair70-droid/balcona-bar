import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasModule } from '../saas/saas.module';
import { StaffModule } from '../staff/staff.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { BranchAdminController } from './branch-admin.controller';
import { BranchAdminService } from './branch-admin.service';

@Module({
  imports: [PrismaModule, SaasModule, StaffAuthModule, StaffModule],
  controllers: [BranchAdminController],
  providers: [BranchAdminService],
  exports: [BranchAdminService],
})
export class BranchAdminModule {}
