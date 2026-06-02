import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffModule } from '../staff/staff.module';
import { StaffSessionGuard } from './guards/staff-session.guard';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';

@Module({
  imports: [PrismaModule, StaffModule, AuditModule],
  controllers: [StaffAuthController],
  providers: [StaffAuthService, StaffSessionGuard],
  exports: [StaffAuthService, StaffSessionGuard],
})
export class StaffAuthModule {}

