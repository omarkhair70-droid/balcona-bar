import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { RequiredPermission } from './required-permission.decorator';
import { StaffAccessService } from './staff-access.service';
import { StaffPermissionGuard } from './staff-permission.guard';
import { StaffCanQueryDto } from './dto/staff-can-query.dto';
import { StaffUserIdParamDto } from './dto/staff-user-id-param.dto';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly staffAccessService: StaffAccessService,
  ) {}

  @Get()
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('staff.read')
  async findAll(@CurrentStaff() currentStaff: StaffAuthContext) {
    const access = await this.staffAccessService.getAccess(
      currentStaff.staffUser.id,
    );
    const companyIds = access.effectiveAccess.companies
      .filter((entry) => entry.branchScope === 'all_branches')
      .map((entry) => entry.company.id);
    const branchIds = access.effectiveAccess.branches.map(
      (entry) => entry.branch.id,
    );

    return this.staffService.findVisibleForAccess({ companyIds, branchIds });
  }

  @Get('me')
  @UseGuards(StaffSessionGuard)
  async me(@CurrentStaff() currentStaff: StaffAuthContext) {
    const access = await this.staffAccessService.getAccess(
      currentStaff.staffUser.id,
    );

    return {
      staffUser: currentStaff.staffUser,
      staffSession: currentStaff.staffSession,
      staffAccess: access.effectiveAccess,
      memberships: access.memberships,
      effectiveAccess: access.effectiveAccess,
      defaultBranch: access.defaultBranch,
    };
  }

  @Get('me/access')
  @UseGuards(StaffSessionGuard)
  meAccess(@CurrentStaff() currentStaff: StaffAuthContext) {
    return this.staffAccessService.getAccess(currentStaff.staffUser.id);
  }

  @Get(':staffUserId/access')
  @UseGuards(StaffSessionGuard)
  async findAccess(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: StaffUserIdParamDto,
  ) {
    if (currentStaff.staffUser.id !== params.staffUserId) {
      await this.staffAccessService.assertCan(
        currentStaff.staffUser.id,
        'staff.read',
      );
    }

    return this.staffAccessService.getAccess(params.staffUserId);
  }

  @Get(':staffUserId/can')
  @UseGuards(StaffSessionGuard)
  async can(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: StaffUserIdParamDto,
    @Query() query: StaffCanQueryDto,
  ) {
    if (currentStaff.staffUser.id !== params.staffUserId) {
      await this.staffAccessService.assertCan(
        currentStaff.staffUser.id,
        'staff.read',
      );
    }

    return this.staffAccessService.can(params.staffUserId, query.permission, {
      companyId: query.companyId,
      branchId: query.branchId,
    });
  }
}
