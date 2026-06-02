import { Controller, Get, Param, Query } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { AnalyticsService } from './analytics.service';
import { CompanyIdParamDto } from './dto/analytics-param.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('branches/:branchId/analytics/overview')
  getBranchOverview(
    @Param() params: BranchIdParamDto,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getBranchOverview(params.branchId, query ?? {});
  }

  @Get('branches/:branchId/analytics/menu')
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

