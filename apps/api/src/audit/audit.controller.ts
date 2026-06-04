import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { CompanyIdParamDto } from './dto/audit-param.dto';

@Controller()
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('branches/:branchId/audit-logs')
  @RequiredPermission('audit.read', { branchIdParam: 'branchId' })
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditService.findForBranch(params.branchId, query ?? {});
  }

  @Get('companies/:companyId/audit-logs')
  @RequiredPermission('audit.read', { companyIdParam: 'companyId' })
  findForCompany(
    @Param() params: CompanyIdParamDto,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditService.findForCompany(params.companyId, query ?? {});
  }
}
