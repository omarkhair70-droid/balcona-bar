import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { AcceptStaffInviteDto } from "./dto/accept-staff-invite.dto";
import { StaffInviteTokenParamDto } from "./dto/staff-invite-token-param.dto";
import { StaffInvitesService } from "./staff-invites.service";

@Controller("staff-auth/invites")
export class StaffInvitesController {
  constructor(private readonly staffInvitesService: StaffInvitesService) {}

  @Get(":token")
  getInvite(@Param() params: StaffInviteTokenParamDto) {
    return this.staffInvitesService.getInviteByToken(params.token);
  }

  @Post(":token/accept")
  acceptInvite(
    @Param() params: StaffInviteTokenParamDto,
    @Body() body: AcceptStaffInviteDto,
  ) {
    return this.staffInvitesService.acceptInvite(params.token, body);
  }
}
