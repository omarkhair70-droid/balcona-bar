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
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { SessionIdParamDto } from '../table-sessions/dto/session-id-param.dto';
import { BranchNotificationsQueryDto } from './dto/branch-notifications-query.dto';
import { BranchPresenceEventsQueryDto } from './dto/branch-presence-events-query.dto';
import { CreatePresenceEventDto } from './dto/create-presence-event.dto';
import { NotificationIdParamDto } from './dto/notification-id-param.dto';
import { PresenceNotificationsService } from './presence-notifications.service';

@Controller()
export class PresenceNotificationsController {
  constructor(
    private readonly presenceNotificationsService: PresenceNotificationsService,
  ) {}

  @Post('presence/events')
  createPresenceEvent(@Body() body: CreatePresenceEventDto) {
    return this.presenceNotificationsService.createPresenceEvent(body);
  }

  @Get('table-sessions/:sessionId/notifications')
  findForTableSession(@Param() params: SessionIdParamDto) {
    return this.presenceNotificationsService.findForTableSession(
      params.sessionId,
    );
  }

  @Post('notifications/:notificationId/read')
  markRead(@Param() params: NotificationIdParamDto) {
    return this.presenceNotificationsService.markRead(params.notificationId);
  }

  @Post('notifications/:notificationId/dismiss')
  dismiss(@Param() params: NotificationIdParamDto) {
    return this.presenceNotificationsService.dismiss(params.notificationId);
  }

  @Get('branches/:branchId/presence/events')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('presence.read', { branchIdParam: 'branchId' })
  findPresenceEventsForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchPresenceEventsQueryDto,
  ) {
    return this.presenceNotificationsService.findPresenceEventsForBranch(
      params.branchId,
      query ?? {},
    );
  }

  @Get('branches/:branchId/notifications')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('notifications.read', { branchIdParam: 'branchId' })
  findNotificationsForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchNotificationsQueryDto,
  ) {
    return this.presenceNotificationsService.findNotificationsForBranch(
      params.branchId,
      query ?? {},
    );
  }
}
