import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasModule } from '../saas/saas.module';
import { StaffModule } from '../staff/staff.module';
import { MenuAdminController } from './menu-admin.controller';
import { MenuAdminService } from './menu-admin.service';

@Module({
  imports: [PrismaModule, SaasModule, StaffModule],
  controllers: [MenuAdminController],
  providers: [MenuAdminService],
})
export class MenuAdminModule {}
