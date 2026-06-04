import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BranchIdParamDto } from "../branches/dto/branch-id-param.dto";
import { CurrentStaff } from "../staff-auth/decorators/current-staff.decorator";
import { StaffSessionGuard } from "../staff-auth/guards/staff-session.guard";
import { StaffAuthContext } from "../staff-auth/staff-auth.types";
import { RequiredPermission } from "../staff/required-permission.decorator";
import { StaffPermissionGuard } from "../staff/staff-permission.guard";
import { StaffScopedAccessService } from "../staff/staff-scoped-access.service";
import { SessionIdParamDto } from "../table-sessions/dto/session-id-param.dto";
import { AiWaiterService } from "./ai-waiter.service";
import { AiWaiterSessionIdParamDto } from "./dto/ai-waiter-session-id-param.dto";
import { CartProposalIdParamDto } from "./dto/cart-proposal-id-param.dto";
import { EscalateAiWaiterDto } from "./dto/escalate-ai-waiter.dto";
import { ListAiWaiterMessagesQueryDto } from "./dto/list-ai-waiter-messages-query.dto";
import { ListAiWaiterSessionsQueryDto } from "./dto/list-ai-waiter-sessions-query.dto";
import { RejectCartProposalDto } from "./dto/reject-cart-proposal.dto";
import { SendAiWaiterMessageDto } from "./dto/send-ai-waiter-message.dto";
import { StartAiWaiterDto } from "./dto/start-ai-waiter.dto";

@Controller()
export class AiWaiterController {
  constructor(
    private readonly aiWaiterService: AiWaiterService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Post("table-sessions/:sessionId/ai-waiter/start")
  start(
    @Param() params: SessionIdParamDto,
    @Body() body: StartAiWaiterDto = {},
  ) {
    return this.aiWaiterService.start(params.sessionId, body ?? {});
  }

  @Get("table-sessions/:sessionId/ai-waiter")
  getCurrent(@Param() params: SessionIdParamDto) {
    return this.aiWaiterService.getCurrent(params.sessionId);
  }

  @Get("table-sessions/:sessionId/ai-waiter/messages")
  listMessages(
    @Param() params: SessionIdParamDto,
    @Query() query: ListAiWaiterMessagesQueryDto,
  ) {
    return this.aiWaiterService.listMessages(params.sessionId, query ?? {});
  }

  @Post("table-sessions/:sessionId/ai-waiter/messages")
  sendMessage(
    @Param() params: SessionIdParamDto,
    @Body() body: SendAiWaiterMessageDto,
  ) {
    return this.aiWaiterService.sendMessage(params.sessionId, body);
  }

  @Post("ai-waiter/cart-proposals/:proposalId/apply")
  applyProposal(@Param() params: CartProposalIdParamDto) {
    return this.aiWaiterService.applyProposal(params.proposalId);
  }

  @Post("ai-waiter/cart-proposals/:proposalId/reject")
  rejectProposal(
    @Param() params: CartProposalIdParamDto,
    @Body() body: RejectCartProposalDto = {},
  ) {
    return this.aiWaiterService.rejectProposal(params.proposalId, body ?? {});
  }

  @Post("table-sessions/:sessionId/ai-waiter/escalate")
  escalate(
    @Param() params: SessionIdParamDto,
    @Body() body: EscalateAiWaiterDto,
  ) {
    return this.aiWaiterService.escalate(params.sessionId, body);
  }

  @Post("table-sessions/:sessionId/ai-waiter/close")
  close(@Param() params: SessionIdParamDto) {
    return this.aiWaiterService.close(params.sessionId);
  }

  @Get("branches/:branchId/ai-waiter/sessions")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("ai_waiter.read", { branchIdParam: "branchId" })
  listBranchSessions(
    @Param() params: BranchIdParamDto,
    @Query() query: ListAiWaiterSessionsQueryDto,
  ) {
    return this.aiWaiterService.listBranchSessions(
      params.branchId,
      query ?? {},
    );
  }

  @Get("ai-waiter/sessions/:aiWaiterSessionId")
  @UseGuards(StaffSessionGuard)
  async getSessionDetail(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: AiWaiterSessionIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForAiWaiterSession(
      currentStaff.staffUser.id,
      "ai_waiter.read",
      params.aiWaiterSessionId,
    );

    return this.aiWaiterService.getSessionDetail(params.aiWaiterSessionId);
  }
}
