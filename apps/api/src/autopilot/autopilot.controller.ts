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
import { TableAttentionService } from './table-attention.service';
import { AttentionQueryDto } from './dto/attention-query.dto';
import { MuteAttentionDto } from './dto/mute-attention.dto';
import { RecalculateAttentionDto } from './dto/recalculate-attention.dto';
import { ResolveAttentionDto } from './dto/resolve-attention.dto';

@Controller()
export class AutopilotController {
  constructor(
    private readonly tableAttentionService: TableAttentionService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('branches/:branchId/autopilot/attention')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('autopilot.read', { branchIdParam: 'branchId' })
  listBranchAttention(
    @Param() params: BranchIdParamDto,
    @Query() query: AttentionQueryDto,
  ) {
    return this.tableAttentionService.listBranchAttention(
      params.branchId,
      query ?? {},
    );
  }

  @Post('branches/:branchId/autopilot/attention/rebuild')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('autopilot.manage', { branchIdParam: 'branchId' })
  rebuildBranchAttention(@Param() params: BranchIdParamDto) {
    return this.tableAttentionService.rebuildBranchAttention(params.branchId);
  }

  @Get('table-sessions/:sessionId/autopilot/attention')
  @UseGuards(StaffSessionGuard)
  async getTableSessionAttention(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SessionIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForTableSession(
      currentStaff.staffUser.id,
      'autopilot.read',
      params.sessionId,
    );

    return this.tableAttentionService.getTableSessionAttention(
      params.sessionId,
    );
  }

  @Post('table-sessions/:sessionId/autopilot/attention/recalculate')
  @UseGuards(StaffSessionGuard)
  async recalculateTableSessionAttention(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SessionIdParamDto,
    @Body() body: RecalculateAttentionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForTableSession(
      currentStaff.staffUser.id,
      'autopilot.manage',
      params.sessionId,
    );

    return this.tableAttentionService.recalculateForTableSession(
      params.sessionId,
      undefined,
      body ?? {},
    );
  }

  @Post('table-sessions/:sessionId/autopilot/attention/resolve')
  @UseGuards(StaffSessionGuard)
  async resolveTableSessionAttention(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SessionIdParamDto,
    @Body() body: ResolveAttentionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForTableSession(
      currentStaff.staffUser.id,
      'autopilot.manage',
      params.sessionId,
    );

    return this.tableAttentionService.resolveTableSession(
      params.sessionId,
      body ?? {},
    );
  }

  @Post('table-sessions/:sessionId/autopilot/attention/mute')
  @UseGuards(StaffSessionGuard)
  async muteTableSessionAttention(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SessionIdParamDto,
    @Body() body: MuteAttentionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForTableSession(
      currentStaff.staffUser.id,
      'autopilot.manage',
      params.sessionId,
    );

    return this.tableAttentionService.muteTableSession(
      params.sessionId,
      body ?? {},
    );
  }
}

