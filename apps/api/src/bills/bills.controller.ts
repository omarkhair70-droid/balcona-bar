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
import { BillRequestIdParamDto } from '../bill-requests/dto/bill-request-id-param.dto';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import { BillActionDto } from './dto/bill-action.dto';
import { BillIdParamDto } from './dto/bill-id-param.dto';
import { BranchBillsQueryDto } from './dto/branch-bills-query.dto';
import { CancelBillDto } from './dto/cancel-bill.dto';
import { RecordManualPaymentDto } from './dto/record-manual-payment.dto';
import { BillsService } from './bills.service';

@Controller()
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('branches/:branchId/bills')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('bills.read', { branchIdParam: 'branchId' })
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchBillsQueryDto = {},
  ) {
    return this.billsService.findForBranch(params.branchId, query ?? {});
  }

  @Post('bill-requests/:billRequestId/bill')
  @UseGuards(StaffSessionGuard)
  async createForBillRequest(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillRequestIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForBillRequest(
      currentStaff.staffUser.id,
      'bills.present',
      params.billRequestId,
    );

    return this.billsService.createOrGetBillForBillRequest(
      params.billRequestId,
      { actorType: 'staff' },
    );
  }

  @Get('bills/:billId')
  @UseGuards(StaffSessionGuard)
  async findOne(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForBill(
      currentStaff.staffUser.id,
      'bills.read',
      params.billId,
    );

    return this.billsService.findOne(params.billId);
  }

  @Post('bills/:billId/present')
  @UseGuards(StaffSessionGuard)
  async present(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillIdParamDto,
    @Body() body: BillActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForBill(
      currentStaff.staffUser.id,
      'bills.present',
      params.billId,
    );

    return this.billsService.present(params.billId, {
      ...(body ?? {}),
      staffUserId: currentStaff.staffUser.id,
    });
  }

  @Post('bills/:billId/manual-payments')
  @UseGuards(StaffSessionGuard)
  async recordManualPayment(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillIdParamDto,
    @Body() body: RecordManualPaymentDto,
  ) {
    await this.staffScopedAccessService.assertCanForBill(
      currentStaff.staffUser.id,
      'bills.pay',
      params.billId,
    );

    return this.billsService.recordManualPayment(
      params.billId,
      body,
      currentStaff.staffUser.id,
    );
  }

  @Post('bills/:billId/cancel')
  @UseGuards(StaffSessionGuard)
  async cancel(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillIdParamDto,
    @Body() body: CancelBillDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForBill(
      currentStaff.staffUser.id,
      'bills.cancel',
      params.billId,
    );

    return this.billsService.cancel(params.billId, {
      ...(body ?? {}),
      staffUserId: currentStaff.staffUser.id,
    });
  }

  @Post('bills/:billId/receipt')
  @UseGuards(StaffSessionGuard)
  async generateReceipt(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForBill(
      currentStaff.staffUser.id,
      'bills.pay',
      params.billId,
    );

    return this.billsService.generateReceipt(
      params.billId,
      currentStaff.staffUser.id,
    );
  }

  @Get('bills/:billId/receipt')
  @UseGuards(StaffSessionGuard)
  async findReceipt(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForBill(
      currentStaff.staffUser.id,
      'bills.read',
      params.billId,
    );

    return this.billsService.findReceipt(params.billId);
  }
}
