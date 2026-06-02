import { Controller, Get, Param, Query } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { CompanyIdParamDto } from './dto/audit-param.dto';

@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('branches/:branchId/audit-logs')
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditService.findForBranch(params.branchId, query ?? {});
  }

  @Get('companies/:companyId/audit-logs')
  findForCompany(
    @Param() params: CompanyIdParamDto,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditService.findForCompany(params.companyId, query ?? {});
  }
}
