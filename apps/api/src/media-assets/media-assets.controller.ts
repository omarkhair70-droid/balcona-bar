import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { MediaAssetsService } from './media-assets.service';

@Controller()
export class MediaAssetsController {
  constructor(private readonly mediaAssetsService: MediaAssetsService) {}

  @Get('companies/:companyId/media-assets')
  listAssets(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListMediaAssetsQueryDto,
  ) {
    return this.mediaAssetsService.listAssets(params.companyId, query);
  }

  @Post('companies/:companyId/media-assets')
  createAsset(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateMediaAssetDto,
  ) {
    return this.mediaAssetsService.createAsset(params.companyId, body);
  }

  @Get('media-assets/:mediaAssetId')
  getAsset(@Param() params: MediaAssetIdParamDto) {
    return this.mediaAssetsService.getAsset(params.mediaAssetId);
  }

  @Patch('media-assets/:mediaAssetId')
  updateAsset(
    @Param() params: MediaAssetIdParamDto,
    @Body() body: UpdateMediaAssetDto,
  ) {
    return this.mediaAssetsService.updateAsset(params.mediaAssetId, body);
  }

  @Post('media-assets/:mediaAssetId/archive')
  archiveAsset(@Param() params: MediaAssetIdParamDto) {
    return this.mediaAssetsService.archiveAsset(params.mediaAssetId);
  }

  @Post('media-assets/:mediaAssetId/restore')
  restoreAsset(@Param() params: MediaAssetIdParamDto) {
    return this.mediaAssetsService.restoreAsset(params.mediaAssetId);
  }

  @Post('media-assets/:mediaAssetId/delete-marker')
  markAssetDeleted(@Param() params: MediaAssetIdParamDto) {
    return this.mediaAssetsService.markAssetDeleted(params.mediaAssetId);
  }

  @Get('media-usages')
  listUsages(@Query() query: ListMediaUsagesQueryDto) {
    return this.mediaAssetsService.listUsages(query);
  }

  @Post('media-assets/:mediaAssetId/usages')
  createUsage(
    @Param() params: MediaAssetIdParamDto,
    @Body() body: CreateMediaUsageDto,
  ) {
    return this.mediaAssetsService.createUsage(params.mediaAssetId, body);
  }

  @Patch('media-usages/:usageId')
  updateUsage(
    @Param() params: MediaUsageIdParamDto,
    @Body() body: UpdateMediaUsageDto,
  ) {
    return this.mediaAssetsService.updateUsage(params.usageId, body);
  }

  @Delete('media-usages/:usageId')
  deleteUsage(@Param() params: MediaUsageIdParamDto) {
    return this.mediaAssetsService.deleteUsage(params.usageId);
  }
}
