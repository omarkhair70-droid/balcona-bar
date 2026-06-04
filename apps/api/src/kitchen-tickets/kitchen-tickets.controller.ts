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
import { BranchKitchenTicketsQueryDto } from './dto/branch-kitchen-tickets-query.dto';
import { KitchenTicketIdParamDto } from './dto/kitchen-ticket-param.dto';
import { ReprintKitchenTicketDto } from './dto/reprint-kitchen-ticket.dto';
import { KitchenTicketsService } from './kitchen-tickets.service';

@Controller()
export class KitchenTicketsController {
  constructor(
    private readonly kitchenTicketsService: KitchenTicketsService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('branches/:branchId/kitchen-tickets')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('preparation.read', { branchIdParam: 'branchId' })
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchKitchenTicketsQueryDto,
  ) {
    return this.kitchenTicketsService.findForBranch(
      params.branchId,
      query ?? {},
    );
  }

  @Get('kitchen-tickets/:ticketId')
  @UseGuards(StaffSessionGuard)
  async findOne(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: KitchenTicketIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForKitchenTicket(
      currentStaff.staffUser.id,
      'preparation.read',
      params.ticketId,
    );

    return this.kitchenTicketsService.findOne(params.ticketId);
  }

  @Post('kitchen-tickets/:ticketId/reprint')
  @UseGuards(StaffSessionGuard)
  async reprint(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: KitchenTicketIdParamDto,
    @Body() body: ReprintKitchenTicketDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForKitchenTicket(
      currentStaff.staffUser.id,
      'preparation.start',
      params.ticketId,
    );

    return this.kitchenTicketsService.requestReprint(
      params.ticketId,
      currentStaff.staffUser.id,
      body.reason,
    );
  }
}
