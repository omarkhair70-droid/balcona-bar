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
export class VenueZonesController {
  constructor(private readonly venueZonesService: VenueZonesService) {}

  @Get('branches/:branchId/venue-zones')
  listForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: ListVenueZonesQueryDto,
  ) {
    return this.venueZonesService.listForBranch(params.branchId, query);
  }

  @Post('branches/:branchId/venue-zones')
  create(@Param() params: BranchIdParamDto, @Body() body: CreateVenueZoneDto) {
    return this.venueZonesService.create(params.branchId, body);
  }

  @Get('venue-zones/:venueZoneId')
  get(@Param() params: VenueZoneIdParamDto) {
    return this.venueZonesService.get(params.venueZoneId);
  }

  @Patch('venue-zones/:venueZoneId')
  update(
    @Param() params: VenueZoneIdParamDto,
    @Body() body: UpdateVenueZoneDto,
  ) {
    return this.venueZonesService.update(params.venueZoneId, body);
  }

  @Delete('venue-zones/:venueZoneId')
  deleteOrArchive(@Param() params: VenueZoneIdParamDto) {
    return this.venueZonesService.deleteOrArchive(params.venueZoneId);
  }
}
