import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import {
  BranchIdParamDto,
  CompanyIdParamDto,
} from './dto/tenant-onboarding-param.dto';
import {
  BulkCreateOnboardingTablesDto,
  CreateOnboardingFloorDto,
  InviteOnboardingStaffDto,
  UpdateBranchOnboardingProfileDto,
  UpdateCompanyOnboardingProfileDto,
  UpdateReadinessCheckDto,
} from './dto/tenant-onboarding.dto';
import { TenantOnboardingService } from './tenant-onboarding.service';

@Controller()
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class TenantOnboardingController {
  constructor(
    private readonly tenantOnboardingService: TenantOnboardingService,
  ) {}

  @Get('companies/:companyId/onboarding')
  @RequiredPermission('tenant_onboarding.read', {
    companyIdParam: 'companyId',
  })
  getCompanyOnboarding(@Param() params: CompanyIdParamDto) {
    return this.tenantOnboardingService.getCompanyOnboarding(params.companyId);
  }

  @Patch('companies/:companyId/onboarding/profile')
  @RequiredPermission('tenant_onboarding.manage', {
    companyIdParam: 'companyId',
  })
  updateCompanyProfile(
    @Param() params: CompanyIdParamDto,
    @Body() body: UpdateCompanyOnboardingProfileDto,
  ) {
    return this.tenantOnboardingService.updateCompanyProfile(
      params.companyId,
      body,
    );
  }

  @Get('branches/:branchId/onboarding')
  @RequiredPermission('tenant_onboarding.read', { branchIdParam: 'branchId' })
  getBranchOnboarding(@Param() params: BranchIdParamDto) {
    return this.tenantOnboardingService.getBranchOnboarding(params.branchId);
  }

  @Patch('branches/:branchId/onboarding/profile')
  @RequiredPermission('tenant_onboarding.manage', { branchIdParam: 'branchId' })
  updateBranchProfile(
    @Param() params: BranchIdParamDto,
    @Body() body: UpdateBranchOnboardingProfileDto,
  ) {
    return this.tenantOnboardingService.updateBranchProfile(
      params.branchId,
      body,
    );
  }

  @Post('branches/:branchId/onboarding/floors')
  @RequiredPermission('tenant_onboarding.manage', { branchIdParam: 'branchId' })
  createFloor(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateOnboardingFloorDto,
  ) {
    return this.tenantOnboardingService.createFloor(params.branchId, body);
  }

  @Post('branches/:branchId/onboarding/tables/bulk')
  @RequiredPermission('tenant_onboarding.manage', { branchIdParam: 'branchId' })
  bulkCreateTables(
    @Param() params: BranchIdParamDto,
    @Body() body: BulkCreateOnboardingTablesDto,
  ) {
    return this.tenantOnboardingService.bulkCreateTables(
      params.branchId,
      body,
    );
  }

  @Post('branches/:branchId/onboarding/staff/invite')
  @RequiredPermission('staff.manage', { branchIdParam: 'branchId' })
  inviteStaff(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BranchIdParamDto,
    @Body() body: InviteOnboardingStaffDto,
  ) {
    return this.tenantOnboardingService.inviteStaff(
      params.branchId,
      body,
      currentStaff.staffUser.id,
    );
  }

  @Post('branches/:branchId/onboarding/readiness-checks')
  @RequiredPermission('tenant_onboarding.manage', { branchIdParam: 'branchId' })
  updateReadinessCheck(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BranchIdParamDto,
    @Body() body: UpdateReadinessCheckDto,
  ) {
    return this.tenantOnboardingService.updateReadinessCheck(
      params.branchId,
      body,
      currentStaff.staffUser.id,
    );
  }

  @Get('branches/:branchId/onboarding/launch-checklist')
  @RequiredPermission('tenant_onboarding.read', { branchIdParam: 'branchId' })
  getLaunchChecklist(@Param() params: BranchIdParamDto) {
    return this.tenantOnboardingService.getLaunchChecklist(params.branchId);
  }
}
