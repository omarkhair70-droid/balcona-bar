import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateExperienceProfileDto,
  ListExperienceProfilesQueryDto,
  UpdateExperienceProfileDto,
} from './dto/experience-profile.dto';
import {
  BranchIdParamDto,
  CompanyIdParamDto,
  ExperienceProfileIdParamDto,
} from './dto/experience-param.dto';
import { ExperienceService } from './experience.service';

@Controller()
export class ExperienceController {
  constructor(private readonly experienceService: ExperienceService) {}

  @Get('companies/:companyId/experience/profiles')
  listCompanyProfiles(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListExperienceProfilesQueryDto,
  ) {
    return this.experienceService.listCompanyProfiles(params.companyId, query);
  }

  @Get('branches/:branchId/experience/profiles')
  listBranchProfiles(
    @Param() params: BranchIdParamDto,
    @Query() query: ListExperienceProfilesQueryDto,
  ) {
    return this.experienceService.listBranchProfiles(params.branchId, query);
  }

  @Post('companies/:companyId/experience/profiles')
  createCompanyProfile(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateExperienceProfileDto,
  ) {
    return this.experienceService.createCompanyProfile(params.companyId, body);
  }

  @Post('branches/:branchId/experience/profiles')
  createBranchProfile(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateExperienceProfileDto,
  ) {
    return this.experienceService.createBranchProfile(params.branchId, body);
  }

  @Get('experience/profiles/:experienceProfileId')
  getProfile(@Param() params: ExperienceProfileIdParamDto) {
    return this.experienceService.getProfile(params.experienceProfileId);
  }

  @Patch('experience/profiles/:experienceProfileId')
  updateProfile(
    @Param() params: ExperienceProfileIdParamDto,
    @Body() body: UpdateExperienceProfileDto,
  ) {
    return this.experienceService.updateProfile(
      params.experienceProfileId,
      body,
    );
  }

  @Post('experience/profiles/:experienceProfileId/activate')
  activateProfile(@Param() params: ExperienceProfileIdParamDto) {
    return this.experienceService.activateProfile(params.experienceProfileId);
  }

  @Post('experience/profiles/:experienceProfileId/archive')
  archiveProfile(@Param() params: ExperienceProfileIdParamDto) {
    return this.experienceService.archiveProfile(params.experienceProfileId);
  }

  @Post('experience/profiles/:experienceProfileId/set-default')
  setDefaultProfile(@Param() params: ExperienceProfileIdParamDto) {
    return this.experienceService.setDefaultProfile(params.experienceProfileId);
  }

  @Get('branches/:branchId/experience/effective')
  getEffectiveBranchExperience(@Param() params: BranchIdParamDto) {
    return this.experienceService.getEffectiveBranchExperience(params.branchId);
  }

  @Get('branches/:branchId/experience-packs/balkona/preview')
  previewBalkonaPack(@Param() params: BranchIdParamDto) {
    return this.experienceService.previewBalkonaPack(params.branchId);
  }

  @Post('branches/:branchId/experience-packs/balkona/apply')
  applyBalkonaPack(@Param() params: BranchIdParamDto) {
    return this.experienceService.applyBalkonaPack(params.branchId);
  }
}
