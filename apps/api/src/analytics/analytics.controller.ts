import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { AnalyticsService } from './analytics.service';
import { CompanyIdParamDto } from './dto/analytics-param.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller()
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('branches/:branchId/analytics/overview')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getBranchOverview(
    @Param() params: BranchIdParamDto,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBranchOverview(params.branchId, query ?? {});
  }

  @Get('branches/:branchId/analytics/menu')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getBranchMenuAnalytics(
    @Param() params: BranchIdParamDto,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBranchMenuAnalytics(
      params.branchId,
      query ?? {},
    );
  }

  @Get('branches/:branchId/analytics/staff-actions')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getBranchStaffActions(
    @Param() params: BranchIdParamDto,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBranchStaffActions(
      params.branchId,
      query ?? {},
    );
  }

  @Get('companies/:companyId/analytics/overview')
  @RequiredPermission('analytics.read', { companyIdParam: 'companyId' })
  getCompanyOverview(
    @Param() params: CompanyIdParamDto,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getCompanyOverview(
      params.companyId,
      query ?? {},
    );
  }
}

