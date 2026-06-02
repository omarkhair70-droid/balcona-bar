import { Controller, Get, Param, Query, Sse } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { SessionIdParamDto } from '../table-sessions/dto/session-id-param.dto';
import { BranchRealtimeEventsQueryDto } from './dto/branch-realtime-events-query.dto';
import { BranchRealtimeQueryDto } from './dto/branch-realtime-query.dto';
import { SessionRealtimeEventsQueryDto } from './dto/session-realtime-events-query.dto';
import { SessionRealtimeQueryDto } from './dto/session-realtime-query.dto';
import { RealtimeEventsService } from './realtime-events.service';

@Controller('realtime')
export class RealtimeEventsController {
  constructor(private readonly realtimeEventsService: RealtimeEventsService) {}

  @Sse('branches/:branchId/stream')
  streamBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchRealtimeQueryDto,
  ) {
    return this.realtimeEventsService.streamBranch(
      params.branchId,
      query ?? {},
    );
  }

  @Sse('table-sessions/:sessionId/stream')
  streamTableSession(
    @Param() params: SessionIdParamDto,
    @Query() query: SessionRealtimeQueryDto,
  ) {
    return this.realtimeEventsService.streamTableSession(
      params.sessionId,
      query ?? {},
    );
  }

  @Get('branches/:branchId/events')
  findBranchEvents(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchRealtimeEventsQueryDto,
  ) {
    return this.realtimeEventsService.findBranchEvents(
      params.branchId,
      query ?? {},
    );
  }

  @Get('table-sessions/:sessionId/events')
  findTableSessionEvents(
    @Param() params: SessionIdParamDto,
    @Query() query: SessionRealtimeEventsQueryDto,
  ) {
    return this.realtimeEventsService.findTableSessionEvents(
      params.sessionId,
      query ?? {},
    );
  }
}
