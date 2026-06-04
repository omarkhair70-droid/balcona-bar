import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import { PrinterStationIdParamDto } from './dto/print-job-param.dto';
import {
  CreatePrinterStationDto,
  UpdatePrinterStationDto,
} from './dto/printer-station.dto';
import { PrinterStationsService } from './printer-stations.service';

@Controller()
export class PrinterStationsController {
  constructor(
    private readonly printerStationsService: PrinterStationsService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('branches/:branchId/printer-stations')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('preparation.read', { branchIdParam: 'branchId' })
  findForBranch(@Param() params: BranchIdParamDto) {
    return this.printerStationsService.findForBranch(params.branchId);
  }

  @Post('branches/:branchId/printer-stations')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('settings.manage', { branchIdParam: 'branchId' })
  create(
    @Param() params: BranchIdParamDto,
    @Body() body: CreatePrinterStationDto,
  ) {
    return this.printerStationsService.create(params.branchId, body);
  }

  @Patch('printer-stations/:printerStationId')
  @UseGuards(StaffSessionGuard)
  async update(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PrinterStationIdParamDto,
    @Body() body: UpdatePrinterStationDto,
  ) {
    await this.staffScopedAccessService.assertCanForPrinterStation(
      currentStaff.staffUser.id,
      'settings.manage',
      params.printerStationId,
    );

    return this.printerStationsService.update(params.printerStationId, body);
  }

  @Post('printer-stations/:printerStationId/disable')
  @UseGuards(StaffSessionGuard)
  async disable(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PrinterStationIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPrinterStation(
      currentStaff.staffUser.id,
      'settings.manage',
      params.printerStationId,
    );

    return this.printerStationsService.disable(params.printerStationId);
  }

  @Post('printer-stations/:printerStationId/test-print')
  @UseGuards(StaffSessionGuard)
  async testPrint(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PrinterStationIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPrinterStation(
      currentStaff.staffUser.id,
      'settings.manage',
      params.printerStationId,
    );

    return this.printerStationsService.testPrint(
      params.printerStationId,
      currentStaff.staffUser.id,
    );
  }
}
