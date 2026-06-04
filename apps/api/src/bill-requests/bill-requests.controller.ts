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
import { SessionIdParamDto } from '../table-sessions/dto/session-id-param.dto';
import { BillRequestIdParamDto } from './dto/bill-request-id-param.dto';
import { BillStaffActionDto } from './dto/bill-staff-action.dto';
import { BranchBillRequestsQueryDto } from './dto/branch-bill-requests-query.dto';
import { CancelBillRequestDto } from './dto/cancel-bill-request.dto';
import { RequestBillDto } from './dto/request-bill.dto';
import { BillRequestsService } from './bill-requests.service';

@Controller()
export class BillRequestsController {
  constructor(
    private readonly billRequestsService: BillRequestsService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Post('table-sessions/:sessionId/bill/request')
  requestBill(
    @Param() params: SessionIdParamDto,
    @Body() body: RequestBillDto = {},
  ) {
    return this.billRequestsService.requestBill(params.sessionId, body ?? {});
  }

  @Get('table-sessions/:sessionId/bill')
  findForTableSession(@Param() params: SessionIdParamDto) {
    return this.billRequestsService.findForTableSession(params.sessionId);
  }

  @Get('branches/:branchId/bill-requests')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('bills.read', { branchIdParam: 'branchId' })
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchBillRequestsQueryDto = {},
  ) {
    return this.billRequestsService.findForBranch(params.branchId, query ?? {});
  }

  @Get('bill-requests/:billRequestId')
  @UseGuards(StaffSessionGuard)
  async findOne(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillRequestIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForBillRequest(
      currentStaff.staffUser.id,
      'bills.read',
      params.billRequestId,
    );

    return this.billRequestsService.findOne(params.billRequestId);
  }

  @Post('bill-requests/:billRequestId/acknowledge')
  @UseGuards(StaffSessionGuard)
  async acknowledge(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillRequestIdParamDto,
    @Body() body: BillStaffActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForBillRequest(
      currentStaff.staffUser.id,
      'bills.acknowledge',
      params.billRequestId,
    );

    return this.billRequestsService.acknowledge(
      params.billRequestId,
      { ...(body ?? {}), staffUserId: currentStaff.staffUser.id },
    );
  }

  @Post('bill-requests/:billRequestId/present')
  @UseGuards(StaffSessionGuard)
  async present(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillRequestIdParamDto,
    @Body() body: BillStaffActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForBillRequest(
      currentStaff.staffUser.id,
      'bills.present',
      params.billRequestId,
    );

    return this.billRequestsService.present(params.billRequestId, {
      ...(body ?? {}),
      staffUserId: currentStaff.staffUser.id,
    });
  }

  @Post('bill-requests/:billRequestId/close')
  @UseGuards(StaffSessionGuard)
  async close(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillRequestIdParamDto,
    @Body() body: BillStaffActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForBillRequest(
      currentStaff.staffUser.id,
      'bills.close',
      params.billRequestId,
    );

    return this.billRequestsService.close(params.billRequestId, {
      ...(body ?? {}),
      staffUserId: currentStaff.staffUser.id,
    });
  }

  @Post('bill-requests/:billRequestId/cancel')
  @UseGuards(StaffSessionGuard)
  async cancel(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BillRequestIdParamDto,
    @Body() body: CancelBillRequestDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForBillRequest(
      currentStaff.staffUser.id,
      'bills.cancel',
      params.billRequestId,
    );

    return this.billRequestsService.cancel(params.billRequestId, {
      ...(body ?? {}),
      staffUserId: currentStaff.staffUser.id,
    });
  }
}
