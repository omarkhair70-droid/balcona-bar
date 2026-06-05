import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import { CashierShiftsService } from './cashier-shifts.service';
import { BranchCashierShiftsQueryDto } from './dto/branch-cashier-shifts-query.dto';
import { CashierShiftIdParamDto } from './dto/cashier-shift-id-param.dto';
import { CloseCashierShiftDto } from './dto/close-cashier-shift.dto';
import { CreateCashAdjustmentDto } from './dto/create-cash-adjustment.dto';
import { OpenCashierShiftDto } from './dto/open-cashier-shift.dto';

@Controller()
export class CashierShiftsController {
  constructor(
    private readonly cashierShiftsService: CashierShiftsService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('branches/:branchId/cashier-shifts/current')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('bills.read', { branchIdParam: 'branchId' })
  getCurrent(@Param() params: BranchIdParamDto) {
    return this.cashierShiftsService.getCurrent(params.branchId);
  }

  @Post('branches/:branchId/cashier-shifts/open')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('bills.pay', { branchIdParam: 'branchId' })
  open(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BranchIdParamDto,
    @Body() body: OpenCashierShiftDto,
  ) {
    return this.cashierShiftsService.open(
      params.branchId,
      body,
      currentStaff.staffUser.id,
    );
  }

  @Get('branches/:branchId/cashier-shifts')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('bills.read', { branchIdParam: 'branchId' })
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchCashierShiftsQueryDto = {},
  ) {
    return this.cashierShiftsService.findForBranch(
      params.branchId,
      query ?? {},
    );
  }

  @Get('cashier-shifts/:shiftId')
  @UseGuards(StaffSessionGuard)
  async findOne(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: CashierShiftIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForCashierShift(
      currentStaff.staffUser.id,
      'bills.read',
      params.shiftId,
    );

    return this.cashierShiftsService.findOne(params.shiftId);
  }

  @Post('cashier-shifts/:shiftId/cash-adjustments')
  @UseGuards(StaffSessionGuard)
  async createCashAdjustment(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: CashierShiftIdParamDto,
    @Body() body: CreateCashAdjustmentDto,
  ) {
    await this.staffScopedAccessService.assertCanForCashierShift(
      currentStaff.staffUser.id,
      'bills.pay',
      params.shiftId,
    );

    return this.cashierShiftsService.createCashAdjustment(
      params.shiftId,
      body,
      currentStaff.staffUser.id,
    );
  }

  @Get('cashier-shifts/:shiftId/x-report')
  @UseGuards(StaffSessionGuard)
  async generateXReport(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: CashierShiftIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForCashierShift(
      currentStaff.staffUser.id,
      'bills.read',
      params.shiftId,
    );

    return this.cashierShiftsService.generateXReport(
      params.shiftId,
      currentStaff.staffUser.id,
    );
  }

  @Post('cashier-shifts/:shiftId/close')
  @UseGuards(StaffSessionGuard)
  async close(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: CashierShiftIdParamDto,
    @Body() body: CloseCashierShiftDto,
  ) {
    await this.staffScopedAccessService.assertCanForCashierShift(
      currentStaff.staffUser.id,
      'bills.close',
      params.shiftId,
    );

    return this.cashierShiftsService.close(
      params.shiftId,
      body,
      currentStaff.staffUser.id,
    );
  }
}
