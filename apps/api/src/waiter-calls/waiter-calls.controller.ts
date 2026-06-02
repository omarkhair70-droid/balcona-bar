import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { SessionIdParamDto } from '../table-sessions/dto/session-id-param.dto';
import { CancelWaiterCallDto } from './dto/cancel-waiter-call.dto';
import { CreateWaiterCallDto } from './dto/create-waiter-call.dto';
import { ResolveWaiterCallDto } from './dto/resolve-waiter-call.dto';
import { WaiterCallIdParamDto } from './dto/waiter-call-id-param.dto';
import { WaiterCallStaffActionDto } from './dto/waiter-call-staff-action.dto';
import { WaiterCallsQueryDto } from './dto/waiter-calls-query.dto';
import { WaiterCallsService } from './waiter-calls.service';

@Controller()
export class WaiterCallsController {
  constructor(private readonly waiterCallsService: WaiterCallsService) {}

  @Post('table-sessions/:sessionId/waiter-calls')
  createForTableSession(
    @Param() params: SessionIdParamDto,
    @Body() body: CreateWaiterCallDto,
  ) {
    return this.waiterCallsService.createForTableSession(
      params.sessionId,
      body,
    );
  }

  @Get('table-sessions/:sessionId/waiter-calls')
  findForTableSession(
    @Param() params: SessionIdParamDto,
    @Query() query: WaiterCallsQueryDto,
  ) {
    return this.waiterCallsService.findForTableSession(
      params.sessionId,
      query ?? {},
    );
  }

  @Get('branches/:branchId/waiter-calls')
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: WaiterCallsQueryDto,
  ) {
    return this.waiterCallsService.findForBranch(params.branchId, query ?? {});
  }

  @Get('waiter-calls/:waiterCallId')
  findOne(@Param() params: WaiterCallIdParamDto) {
    return this.waiterCallsService.findOne(params.waiterCallId);
  }

  @Post('waiter-calls/:waiterCallId/acknowledge')
  acknowledge(
    @Param() params: WaiterCallIdParamDto,
    @Body() body: WaiterCallStaffActionDto = {},
  ) {
    return this.waiterCallsService.acknowledge(
      params.waiterCallId,
      body ?? {},
    );
  }

  @Post('waiter-calls/:waiterCallId/resolve')
  resolve(
    @Param() params: WaiterCallIdParamDto,
    @Body() body: ResolveWaiterCallDto = {},
  ) {
    return this.waiterCallsService.resolve(params.waiterCallId, body ?? {});
  }

  @Post('waiter-calls/:waiterCallId/cancel')
  cancel(
    @Param() params: WaiterCallIdParamDto,
    @Body() body: CancelWaiterCallDto = {},
  ) {
    return this.waiterCallsService.cancel(params.waiterCallId, body ?? {});
  }
}
