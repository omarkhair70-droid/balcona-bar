import { Module } from '@nestjs/common';
import { SaasModule } from '../saas/saas.module';
import { StaffModule } from '../staff/staff.module';
import { TenantOnboardingController } from './tenant-onboarding.controller';
import { TenantOnboardingService } from './tenant-onboarding.service';

@Module({
  imports: [SaasModule, StaffModule],
  controllers: [TenantOnboardingController],
  providers: [TenantOnboardingService],
  exports: [TenantOnboardingService],
})
export class TenantOnboardingModule {}
