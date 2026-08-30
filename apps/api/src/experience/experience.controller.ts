import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
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
  constructor(
    private readonly experienceService: ExperienceService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('companies/:companyId/experience/profiles')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('experience.read', { companyIdParam: 'companyId' })
  listCompanyProfiles(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListExperienceProfilesQueryDto,
  ) {
    return this.experienceService.listCompanyProfiles(params.companyId, query);
  }

  @Get('branches/:branchId/experience/profiles')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('experience.read', { branchIdParam: 'branchId' })
  listBranchProfiles(
    @Param() params: BranchIdParamDto,
    @Query() query: ListExperienceProfilesQueryDto,
  ) {
    return this.experienceService.listBranchProfiles(params.branchId, query);
  }

  @Post('companies/:companyId/experience/profiles')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('experience.manage', { companyIdParam: 'companyId' })
  createCompanyProfile(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateExperienceProfileDto,
  ) {
    return this.experienceService.createCompanyProfile(params.companyId, body);
  }

  @Post('branches/:branchId/experience/profiles')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('experience.manage', { branchIdParam: 'branchId' })
  createBranchProfile(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateExperienceProfileDto,
  ) {
    return this.experienceService.createBranchProfile(params.branchId, body);
  }

  @Get('experience/profiles/:experienceProfileId')
  @UseGuards(StaffSessionGuard)
  async getProfile(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ExperienceProfileIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForExperienceProfile(
      currentStaff.staffUser.id,
      'experience.read',
      params.experienceProfileId,
    );
    return this.experienceService.getProfile(params.experienceProfileId);
  }

  @Patch('experience/profiles/:experienceProfileId')
  @UseGuards(StaffSessionGuard)
  async updateProfile(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ExperienceProfileIdParamDto,
    @Body() body: UpdateExperienceProfileDto,
  ) {
    await this.staffScopedAccessService.assertCanForExperienceProfile(
      currentStaff.staffUser.id,
      'experience.manage',
      params.experienceProfileId,
    );
    return this.experienceService.updateProfile(params.experienceProfileId, body);
  }

  @Post('experience/profiles/:experienceProfileId/activate')
  @UseGuards(StaffSessionGuard)
  async activateProfile(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ExperienceProfileIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForExperienceProfile(
      currentStaff.staffUser.id,
      'experience.manage',
      params.experienceProfileId,
    );
    return this.experienceService.activateProfile(params.experienceProfileId);
  }

  @Post('experience/profiles/:experienceProfileId/archive')
  @UseGuards(StaffSessionGuard)
  async archiveProfile(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ExperienceProfileIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForExperienceProfile(
      currentStaff.staffUser.id,
      'experience.manage',
      params.experienceProfileId,
    );
    return this.experienceService.archiveProfile(params.experienceProfileId);
  }

  @Post('experience/profiles/:experienceProfileId/set-default')
  @UseGuards(StaffSessionGuard)
  async setDefaultProfile(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ExperienceProfileIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForExperienceProfile(
      currentStaff.staffUser.id,
      'experience.manage',
      params.experienceProfileId,
    );
    return this.experienceService.setDefaultProfile(params.experienceProfileId);
  }

  @Get('branches/:branchId/experience/effective')
  getEffectiveBranchExperience(@Param() params: BranchIdParamDto) {
    return this.experienceService.getEffectiveBranchExperience(params.branchId);
  }

  @Get('branches/:branchId/experience-packs/balkona/preview')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('experience.read', { branchIdParam: 'branchId' })
  previewBalkonaPack(@Param() params: BranchIdParamDto) {
    return this.experienceService.previewBalkonaPack(params.branchId);
  }

  @Post('branches/:branchId/experience-packs/balkona/apply')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('experience.manage', { branchIdParam: 'branchId' })
  applyBalkonaPack(@Param() params: BranchIdParamDto) {
    return this.experienceService.applyBalkonaPack(params.branchId);
  }
}
