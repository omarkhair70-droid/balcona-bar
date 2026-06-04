import {
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
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import {
  CreateVenueZoneDto,
  ListVenueZonesQueryDto,
  UpdateVenueZoneDto,
} from './dto/venue-zone.dto';
import {
  BranchIdParamDto,
  VenueZoneIdParamDto,
} from './dto/venue-zone-param.dto';
import { VenueZonesService } from './venue-zones.service';

@Controller()
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class VenueZonesController {
  constructor(
    private readonly venueZonesService: VenueZonesService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('branches/:branchId/venue-zones')
  @RequiredPermission('venue_zones.read', { branchIdParam: 'branchId' })
  listForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: ListVenueZonesQueryDto,
  ) {
    return this.venueZonesService.listForBranch(params.branchId, query);
  }

  @Post('branches/:branchId/venue-zones')
  @RequiredPermission('venue_zones.manage', { branchIdParam: 'branchId' })
  create(@Param() params: BranchIdParamDto, @Body() body: CreateVenueZoneDto) {
    return this.venueZonesService.create(params.branchId, body);
  }

  @Get('venue-zones/:venueZoneId')
  async get(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: VenueZoneIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForVenueZone(
      currentStaff.staffUser.id,
      'venue_zones.read',
      params.venueZoneId,
    );

    return this.venueZonesService.get(params.venueZoneId);
  }

  @Patch('venue-zones/:venueZoneId')
  async update(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: VenueZoneIdParamDto,
    @Body() body: UpdateVenueZoneDto,
  ) {
    await this.staffScopedAccessService.assertCanForVenueZone(
      currentStaff.staffUser.id,
      'venue_zones.manage',
      params.venueZoneId,
    );

    return this.venueZonesService.update(params.venueZoneId, body);
  }

  @Delete('venue-zones/:venueZoneId')
  async deleteOrArchive(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: VenueZoneIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForVenueZone(
      currentStaff.staffUser.id,
      'venue_zones.manage',
      params.venueZoneId,
    );

    return this.venueZonesService.deleteOrArchive(params.venueZoneId);
  }
}
