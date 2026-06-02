import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { SessionIdParamDto } from '../table-sessions/dto/session-id-param.dto';
import { TableAttentionService } from './table-attention.service';
import { AttentionQueryDto } from './dto/attention-query.dto';
import { MuteAttentionDto } from './dto/mute-attention.dto';
import { RecalculateAttentionDto } from './dto/recalculate-attention.dto';
import { ResolveAttentionDto } from './dto/resolve-attention.dto';

@Controller()
export class AutopilotController {
  constructor(private readonly tableAttentionService: TableAttentionService) {}

  @Get('branches/:branchId/autopilot/attention')
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
  rebuildBranchAttention(@Param() params: BranchIdParamDto) {
    return this.tableAttentionService.rebuildBranchAttention(params.branchId);
  }

  @Get('table-sessions/:sessionId/autopilot/attention')
  getTableSessionAttention(@Param() params: SessionIdParamDto) {
    return this.tableAttentionService.getTableSessionAttention(
      params.sessionId,
    );
  }

  @Post('table-sessions/:sessionId/autopilot/attention/recalculate')
  recalculateTableSessionAttention(
    @Param() params: SessionIdParamDto,
    @Body() body: RecalculateAttentionDto = {},
  ) {
    return this.tableAttentionService.recalculateForTableSession(
      params.sessionId,
      undefined,
      body ?? {},
    );
  }

  @Post('table-sessions/:sessionId/autopilot/attention/resolve')
  resolveTableSessionAttention(
    @Param() params: SessionIdParamDto,
    @Body() body: ResolveAttentionDto = {},
  ) {
    return this.tableAttentionService.resolveTableSession(
      params.sessionId,
      body ?? {},
    );
  }

  @Post('table-sessions/:sessionId/autopilot/attention/mute')
  muteTableSessionAttention(
    @Param() params: SessionIdParamDto,
    @Body() body: MuteAttentionDto = {},
  ) {
    return this.tableAttentionService.muteTableSession(
      params.sessionId,
      body ?? {},
    );
  }
}

