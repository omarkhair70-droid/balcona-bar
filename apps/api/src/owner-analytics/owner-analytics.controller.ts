import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { OwnerAnalyticsQueryDto } from './dto/owner-analytics-query.dto';
import { OwnerAnalyticsService } from './owner-analytics.service';

@Controller('branches/:branchId/owner-analytics')
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class OwnerAnalyticsController {
  constructor(
    private readonly ownerAnalyticsService: OwnerAnalyticsService,
  ) {}

  @Get('summary')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getSummary(
    @Param() params: BranchIdParamDto,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.ownerAnalyticsService.getSummary(
      params.branchId,
      query ?? {},
    );
  }

  @Get('sales')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getSales(
    @Param() params: BranchIdParamDto,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.ownerAnalyticsService.getSales(params.branchId, query ?? {});
  }

  @Get('orders')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getOrders(
    @Param() params: BranchIdParamDto,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.ownerAnalyticsService.getOrders(params.branchId, query ?? {});
  }

  @Get('items')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getItems(
    @Param() params: BranchIdParamDto,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.ownerAnalyticsService.getItems(params.branchId, query ?? {});
  }

  @Get('operations')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getOperations(
    @Param() params: BranchIdParamDto,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.ownerAnalyticsService.getOperations(
      params.branchId,
      query ?? {},
    );
  }

  @Get('cashier-shifts')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getCashierShifts(
    @Param() params: BranchIdParamDto,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.ownerAnalyticsService.getCashierShifts(
      params.branchId,
      query ?? {},
    );
  }

  @Get('ai-waiter')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getAiWaiter(
    @Param() params: BranchIdParamDto,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.ownerAnalyticsService.getAiWaiter(params.branchId, query ?? {});
  }

  @Get('dashboard')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getDashboard(
    @Param() params: BranchIdParamDto,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.ownerAnalyticsService.getDashboard(
      params.branchId,
      query ?? {},
    );
  }

  @Get('daily-report')
  @RequiredPermission('analytics.read', { branchIdParam: 'branchId' })
  getDailyReport(
    @Param() params: BranchIdParamDto,
    @Query() query: OwnerAnalyticsQueryDto,
  ) {
    return this.ownerAnalyticsService.getDailyReport(
      params.branchId,
      query ?? {},
    );
  }
}
