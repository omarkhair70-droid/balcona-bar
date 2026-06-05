import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { RequiredPermission } from "../staff/required-permission.decorator";
import { StaffPermissionGuard } from "../staff/staff-permission.guard";
import { StaffSessionGuard } from "../staff-auth/guards/staff-session.guard";
import { AssignCompanyPlanDto } from "./dto/assign-company-plan.dto";
import {
  SaasBranchIdParamDto,
  SaasCompanyIdParamDto,
} from "./dto/saas-param.dto";
import { SaasService } from "./saas.service";

@Controller()
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  @Get("saas/plans")
  getPlans() {
    return this.saasService.getPlans();
  }

  @Get("companies/:companyId/saas/status")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("saas.read", { companyIdParam: "companyId" })
  getCompanyStatus(@Param() params: SaasCompanyIdParamDto) {
    return this.saasService.getCompanySaasStatus(params.companyId);
  }

  @Get("branches/:branchId/saas/status")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("saas.read", { branchIdParam: "branchId" })
  getBranchStatus(@Param() params: SaasBranchIdParamDto) {
    return this.saasService.getBranchSaasStatus(params.branchId);
  }

  @Post("dev/companies/:companyId/saas/assign-plan")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("saas.manage", { companyIdParam: "companyId" })
  assignCompanyPlanForDev(
    @Param() params: SaasCompanyIdParamDto,
    @Body() body: AssignCompanyPlanDto,
  ) {
    return this.saasService.assignCompanyPlanForDev(params.companyId, body);
  }
}
