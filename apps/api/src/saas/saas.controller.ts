import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RequiredPermission } from "../staff/required-permission.decorator";
import { StaffPermissionGuard } from "../staff/staff-permission.guard";
import { CurrentStaff } from "../staff-auth/decorators/current-staff.decorator";
import { StaffAuthContext } from "../staff-auth/staff-auth.types";
import { StaffSessionGuard } from "../staff-auth/guards/staff-session.guard";
import { AssignCompanyPlanDto } from "./dto/assign-company-plan.dto";
import {
  CancelSaasBillingDto,
  ChangeSaasBillingPlanDto,
  PaymobSaasBillingWebhookDto,
  PaymobSaasBillingWebhookQueryDto,
  StartSaasBillingCheckoutDto,
} from "./dto/saas-billing.dto";
import {
  SaasBranchIdParamDto,
  SaasCompanyIdParamDto,
} from "./dto/saas-param.dto";
import { SaasBillingService } from "./saas-billing.service";
import { SaasService } from "./saas.service";

@Controller()
export class SaasController {
  constructor(
    private readonly saasService: SaasService,
    private readonly saasBillingService: SaasBillingService,
  ) {}

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


  @Get("companies/:companyId/saas/billing")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("saas.read", { companyIdParam: "companyId" })
  getCompanyBilling(@Param() params: SaasCompanyIdParamDto) {
    return this.saasBillingService.getCompanyBillingOverview(params.companyId);
  }

  @Post("companies/:companyId/saas/billing/checkout")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("saas.manage", { companyIdParam: "companyId" })
  startCompanyBillingCheckout(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SaasCompanyIdParamDto,
    @Body() body: StartSaasBillingCheckoutDto,
  ) {
    return this.saasBillingService.startCompanyCheckout(
      params.companyId,
      currentStaff.staffUser.id,
      body,
    );
  }

  @Post("companies/:companyId/saas/billing/sync")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("saas.manage", { companyIdParam: "companyId" })
  syncCompanyBilling(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SaasCompanyIdParamDto,
  ) {
    return this.saasBillingService.syncCompanySubscription(
      params.companyId,
      currentStaff.staffUser.id,
    );
  }

  @Post("companies/:companyId/saas/billing/change-plan")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("saas.manage", { companyIdParam: "companyId" })
  changeCompanyBillingPlan(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SaasCompanyIdParamDto,
    @Body() body: ChangeSaasBillingPlanDto,
  ) {
    return this.saasBillingService.changeCompanyPlan(
      params.companyId,
      currentStaff.staffUser.id,
      body,
    );
  }

  @Post("companies/:companyId/saas/billing/cancel")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("saas.manage", { companyIdParam: "companyId" })
  cancelCompanyBilling(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SaasCompanyIdParamDto,
    @Body() body: CancelSaasBillingDto = {},
  ) {
    return this.saasBillingService.cancelCompanySubscription(
      params.companyId,
      currentStaff.staffUser.id,
      body,
    );
  }

  @Post("saas-billing/webhooks/paymob/transaction")
  processPaymobSaasBillingTransaction(
    @Query() query: PaymobSaasBillingWebhookQueryDto,
    @Body() body: PaymobSaasBillingWebhookDto,
  ) {
    return this.saasBillingService.processPaymobTransactionWebhook(
      query.hmac,
      body.obj,
    );
  }

  @Post("saas-billing/webhooks/paymob/subscription")
  processPaymobSaasBillingSubscription(@Body() body: unknown) {
    return this.saasBillingService.processPaymobSubscriptionWebhook(body);
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
