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
import { CancelWaiterCallDto } from './dto/cancel-waiter-call.dto';
import { CreateWaiterCallDto } from './dto/create-waiter-call.dto';
import { ResolveWaiterCallDto } from './dto/resolve-waiter-call.dto';
import { WaiterCallIdParamDto } from './dto/waiter-call-id-param.dto';
import { WaiterCallStaffActionDto } from './dto/waiter-call-staff-action.dto';
import { WaiterCallsQueryDto } from './dto/waiter-calls-query.dto';
import { WaiterCallsService } from './waiter-calls.service';

@Controller()
export class WaiterCallsController {
  constructor(
    private readonly waiterCallsService: WaiterCallsService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

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
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('waiter_calls.read', { branchIdParam: 'branchId' })
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: WaiterCallsQueryDto,
  ) {
    return this.waiterCallsService.findForBranch(params.branchId, query ?? {});
  }

  @Get('waiter-calls/:waiterCallId')
  @UseGuards(StaffSessionGuard)
  async findOne(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: WaiterCallIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForWaiterCall(
      currentStaff.staffUser.id,
      'waiter_calls.read',
      params.waiterCallId,
    );

    return this.waiterCallsService.findOne(params.waiterCallId);
  }

  @Post('waiter-calls/:waiterCallId/acknowledge')
  @UseGuards(StaffSessionGuard)
  async acknowledge(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: WaiterCallIdParamDto,
    @Body() body: WaiterCallStaffActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForWaiterCall(
      currentStaff.staffUser.id,
      'waiter_calls.acknowledge',
      params.waiterCallId,
    );

    return this.waiterCallsService.acknowledge(
      params.waiterCallId,
      body ?? {},
    );
  }

  @Post('waiter-calls/:waiterCallId/resolve')
  @UseGuards(StaffSessionGuard)
  async resolve(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: WaiterCallIdParamDto,
    @Body() body: ResolveWaiterCallDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForWaiterCall(
      currentStaff.staffUser.id,
      'waiter_calls.resolve',
      params.waiterCallId,
    );

    return this.waiterCallsService.resolve(params.waiterCallId, body ?? {});
  }

  @Post('waiter-calls/:waiterCallId/cancel')
  @UseGuards(StaffSessionGuard)
  async cancel(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: WaiterCallIdParamDto,
    @Body() body: CancelWaiterCallDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForWaiterCall(
      currentStaff.staffUser.id,
      'waiter_calls.cancel',
      params.waiterCallId,
    );

    return this.waiterCallsService.cancel(params.waiterCallId, body ?? {});
  }
}
