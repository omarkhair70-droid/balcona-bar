import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateMediaAssetDto,
  CreateMediaUsageDto,
  ListMediaAssetsQueryDto,
  ListMediaUsagesQueryDto,
  UpdateMediaAssetDto,
  UpdateMediaUsageDto,
} from './dto/media-asset.dto';
import {
  CompanyIdParamDto,
  MediaAssetIdParamDto,
  MediaUsageIdParamDto,
} from './dto/media-param.dto';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import { MediaAssetsService } from './media-assets.service';

@Controller()
export class MediaAssetsController {
  constructor(
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('companies/:companyId/media-assets')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('media.read', { companyIdParam: 'companyId' })
  listAssets(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListMediaAssetsQueryDto,
  ) {
    return this.mediaAssetsService.listAssets(params.companyId, query);
  }

  @Post('companies/:companyId/media-assets')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('media.manage', { companyIdParam: 'companyId' })
  createAsset(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateMediaAssetDto,
  ) {
    return this.mediaAssetsService.createAsset(params.companyId, body);
  }

  @Get('media-assets/:mediaAssetId')
  @UseGuards(StaffSessionGuard)
  async getAsset(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MediaAssetIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMediaAsset(
      currentStaff.staffUser.id,
      'media.read',
      params.mediaAssetId,
    );
    return this.mediaAssetsService.getAsset(params.mediaAssetId);
  }

  @Patch('media-assets/:mediaAssetId')
  @UseGuards(StaffSessionGuard)
  async updateAsset(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MediaAssetIdParamDto,
    @Body() body: UpdateMediaAssetDto,
  ) {
    await this.staffScopedAccessService.assertCanForMediaAsset(
      currentStaff.staffUser.id,
      'media.manage',
      params.mediaAssetId,
    );
    return this.mediaAssetsService.updateAsset(params.mediaAssetId, body);
  }

  @Post('media-assets/:mediaAssetId/archive')
  @UseGuards(StaffSessionGuard)
  async archiveAsset(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MediaAssetIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMediaAsset(
      currentStaff.staffUser.id,
      'media.manage',
      params.mediaAssetId,
    );
    return this.mediaAssetsService.archiveAsset(params.mediaAssetId);
  }

  @Post('media-assets/:mediaAssetId/restore')
  @UseGuards(StaffSessionGuard)
  async restoreAsset(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MediaAssetIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMediaAsset(
      currentStaff.staffUser.id,
      'media.manage',
      params.mediaAssetId,
    );
    return this.mediaAssetsService.restoreAsset(params.mediaAssetId);
  }

  @Post('media-assets/:mediaAssetId/delete-marker')
  @UseGuards(StaffSessionGuard)
  async markAssetDeleted(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MediaAssetIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMediaAsset(
      currentStaff.staffUser.id,
      'media.manage',
      params.mediaAssetId,
    );
    return this.mediaAssetsService.markAssetDeleted(params.mediaAssetId);
  }

  @Get('media-usages')
  @UseGuards(StaffSessionGuard)
  async listUsages(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Query() query: ListMediaUsagesQueryDto,
  ) {
    if (!query.companyId) {
      throw new BadRequestException(
        'companyId is required for scoped media usage listing',
      );
    }
    await this.staffScopedAccessService.assertCanForCompany(
      currentStaff.staffUser.id,
      'media.read',
      query.companyId,
    );
    return this.mediaAssetsService.listUsages(query);
  }

  @Post('media-assets/:mediaAssetId/usages')
  @UseGuards(StaffSessionGuard)
  async createUsage(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MediaAssetIdParamDto,
    @Body() body: CreateMediaUsageDto,
  ) {
    await this.staffScopedAccessService.assertCanForMediaAsset(
      currentStaff.staffUser.id,
      'media.manage',
      params.mediaAssetId,
    );
    return this.mediaAssetsService.createUsage(params.mediaAssetId, body);
  }

  @Patch('media-usages/:usageId')
  @UseGuards(StaffSessionGuard)
  async updateUsage(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MediaUsageIdParamDto,
    @Body() body: UpdateMediaUsageDto,
  ) {
    await this.staffScopedAccessService.assertCanForMediaUsage(
      currentStaff.staffUser.id,
      'media.manage',
      params.usageId,
    );
    return this.mediaAssetsService.updateUsage(params.usageId, body);
  }

  @Delete('media-usages/:usageId')
  @UseGuards(StaffSessionGuard)
  async deleteUsage(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MediaUsageIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMediaUsage(
      currentStaff.staffUser.id,
      'media.manage',
      params.usageId,
    );
    return this.mediaAssetsService.deleteUsage(params.usageId);
  }
}
