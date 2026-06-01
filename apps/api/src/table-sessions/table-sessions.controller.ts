import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { CloseTableSessionDto } from './dto/close-table-session.dto';
import { SessionIdParamDto } from './dto/session-id-param.dto';
import { StartTableSessionDto } from './dto/start-table-session.dto';
import { TableSessionsService } from './table-sessions.service';

@Controller()
export class TableSessionsController {
  constructor(private readonly tableSessionsService: TableSessionsService) {}

  @Post('table-sessions/start')
  start(@Body() body: StartTableSessionDto) {
    return this.tableSessionsService.start(body);
  }

  @Get('table-sessions/:sessionId')
  findOne(@Param() params: SessionIdParamDto) {
    return this.tableSessionsService.findOne(params.sessionId);
  }

  @Post('table-sessions/:sessionId/view')
  view(@Param() params: SessionIdParamDto) {
    return this.tableSessionsService.view(params.sessionId);
  }

  @Post('table-sessions/:sessionId/close')
  close(@Param() params: SessionIdParamDto, @Body() body: CloseTableSessionDto) {
    return this.tableSessionsService.close(params.sessionId, body.reason);
  }

  @Get('branches/:branchId/table-sessions/active')
  findActiveForBranch(@Param() params: BranchIdParamDto) {
    return this.tableSessionsService.findActiveForBranch(params.branchId);
  }
}
