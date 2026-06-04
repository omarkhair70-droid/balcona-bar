import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { BranchSettingsService } from './branch-settings.service';
import { FeatureFlagKeyParamDto } from './dto/feature-flag-key-param.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { UpdateOperatingSettingsDto } from './dto/update-operating-settings.dto';

@Controller()
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class BranchSettingsController {
  constructor(private readonly branchSettingsService: BranchSettingsService) {}

  @Get('branches/:branchId/operating-settings')
  @RequiredPermission('settings.read', { branchIdParam: 'branchId' })
  getOperatingSettings(@Param() params: BranchIdParamDto) {
    return this.branchSettingsService.getOperatingSettings(params.branchId);
  }

  @Put('branches/:branchId/operating-settings')
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  updateOperatingSettings(
    @Param() params: BranchIdParamDto,
    @Body() body: UpdateOperatingSettingsDto,
  ) {
    return this.branchSettingsService.updateOperatingSettings(
      params.branchId,
      body ?? {},
    );
  }

  @Get('branches/:branchId/feature-flags')
  @RequiredPermission('feature_flags.read', { branchIdParam: 'branchId' })
  listFeatureFlags(@Param() params: BranchIdParamDto) {
    return this.branchSettingsService.listFeatureFlags(params.branchId);
  }

  @Put('branches/:branchId/feature-flags/:key')
  @RequiredPermission('feature_flags.manage', { branchIdParam: 'branchId' })
  updateFeatureFlag(
    @Param() params: BranchIdParamDto & FeatureFlagKeyParamDto,
    @Body() body: UpdateFeatureFlagDto = {},
  ) {
    return this.branchSettingsService.updateFeatureFlag(
      params.branchId,
      params.key,
      body ?? {},
    );
  }
}
