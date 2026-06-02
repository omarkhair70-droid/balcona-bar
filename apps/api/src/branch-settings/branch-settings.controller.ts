import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { BranchSettingsService } from './branch-settings.service';
import { FeatureFlagKeyParamDto } from './dto/feature-flag-key-param.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { UpdateOperatingSettingsDto } from './dto/update-operating-settings.dto';

@Controller()
export class BranchSettingsController {
  constructor(private readonly branchSettingsService: BranchSettingsService) {}

  @Get('branches/:branchId/operating-settings')
  getOperatingSettings(@Param() params: BranchIdParamDto) {
    return this.branchSettingsService.getOperatingSettings(params.branchId);
  }

  @Put('branches/:branchId/operating-settings')
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
  listFeatureFlags(@Param() params: BranchIdParamDto) {
    return this.branchSettingsService.listFeatureFlags(params.branchId);
  }

  @Put('branches/:branchId/feature-flags/:key')
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
