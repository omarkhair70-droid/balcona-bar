import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { SessionIdParamDto } from '../table-sessions/dto/session-id-param.dto';
import { BillRequestIdParamDto } from './dto/bill-request-id-param.dto';
import { BillStaffActionDto } from './dto/bill-staff-action.dto';
import { BranchBillRequestsQueryDto } from './dto/branch-bill-requests-query.dto';
import { CancelBillRequestDto } from './dto/cancel-bill-request.dto';
import { RequestBillDto } from './dto/request-bill.dto';
import { BillRequestsService } from './bill-requests.service';

@Controller()
export class BillRequestsController {
  constructor(private readonly billRequestsService: BillRequestsService) {}

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
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchBillRequestsQueryDto = {},
  ) {
    return this.billRequestsService.findForBranch(params.branchId, query ?? {});
  }

  @Get('bill-requests/:billRequestId')
  findOne(@Param() params: BillRequestIdParamDto) {
    return this.billRequestsService.findOne(params.billRequestId);
  }

  @Post('bill-requests/:billRequestId/acknowledge')
  acknowledge(
    @Param() params: BillRequestIdParamDto,
    @Body() body: BillStaffActionDto = {},
  ) {
    return this.billRequestsService.acknowledge(
      params.billRequestId,
      body ?? {},
    );
  }

  @Post('bill-requests/:billRequestId/present')
  present(
    @Param() params: BillRequestIdParamDto,
    @Body() body: BillStaffActionDto = {},
  ) {
    return this.billRequestsService.present(params.billRequestId, body ?? {});
  }

  @Post('bill-requests/:billRequestId/close')
  close(
    @Param() params: BillRequestIdParamDto,
    @Body() body: BillStaffActionDto = {},
  ) {
    return this.billRequestsService.close(params.billRequestId, body ?? {});
  }

  @Post('bill-requests/:billRequestId/cancel')
  cancel(
    @Param() params: BillRequestIdParamDto,
    @Body() body: CancelBillRequestDto = {},
  ) {
    return this.billRequestsService.cancel(params.billRequestId, body ?? {});
  }
}
