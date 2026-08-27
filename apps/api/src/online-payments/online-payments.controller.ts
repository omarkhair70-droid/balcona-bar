import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BranchIdParamDto } from "../branches/dto/branch-id-param.dto";
import { CurrentStaff } from "../staff-auth/decorators/current-staff.decorator";
import { StaffSessionGuard } from "../staff-auth/guards/staff-session.guard";
import { StaffAuthContext } from "../staff-auth/staff-auth.types";
import { RequiredPermission } from "../staff/required-permission.decorator";
import { StaffPermissionGuard } from "../staff/staff-permission.guard";
import { StaffScopedAccessService } from "../staff/staff-scoped-access.service";
import { CustomerSessionAccessGuard } from "../table-sessions/guards/customer-session-access.guard";
import { BranchOnlinePaymentsQueryDto } from "./dto/branch-online-payments-query.dto";
import { CreateOnlinePaymentIntentDto } from "./dto/create-online-payment-intent.dto";
import {
  FailOnlinePaymentDto,
  MockOnlinePaymentWebhookDto,
} from "./dto/mock-online-payment-webhook.dto";
import {
  CustomerBillOnlinePaymentParamDto,
  CustomerOnlinePaymentIntentParamDto,
} from "./dto/online-payment-customer-param.dto";
import {
  OnlinePaymentIntentIdParamDto,
  OnlinePaymentOperationIdParamDto,
} from "./dto/online-payment-id-param.dto";
import {
  ImportOnlinePaymentSettlementDto,
  OnlinePaymentReconciliationIssueIdParamDto,
  OnlinePaymentReconciliationRunIdParamDto,
  OnlinePaymentSettlementBatchIdParamDto,
  ReconciliationIssueActionDto,
  ReconciliationIssuesQueryDto,
  ReconciliationRunsQueryDto,
  StartOnlinePaymentReconciliationDto,
} from "./dto/payment-reconciliation.dto";
import {
  CaptureOnlinePaymentDto,
  RefundOnlinePaymentDto,
  VoidOnlinePaymentDto,
} from "./dto/post-payment-operation.dto";
import {
  PaymobTransactionWebhookDto,
  PaymobTransactionWebhookQueryDto,
} from "./dto/paymob-transaction-webhook.dto";
import { OnlinePaymentsService } from "./online-payments.service";
import { PaymentRateLimit } from "./payment-rate-limit.decorator";
import { PaymentRateLimitGuard } from "./payment-rate-limit.guard";
import { PaymentReconciliationService } from "./payment-reconciliation.service";
import { StaffPaymentOperationRateLimitGuard } from "./staff-payment-operation-rate-limit.guard";
import { StaffPaymentRecoveryRateLimitGuard } from "./staff-payment-recovery-rate-limit.guard";

@Controller()
export class OnlinePaymentsController {
  constructor(
    private readonly onlinePaymentsService: OnlinePaymentsService,
    private readonly paymentReconciliationService: PaymentReconciliationService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Post("customer/sessions/:sessionId/bills/:billId/online-payment-intents")
  @UseGuards(CustomerSessionAccessGuard, PaymentRateLimitGuard)
  @PaymentRateLimit("customer_create")
  createIntentForCustomer(
    @Param() params: CustomerBillOnlinePaymentParamDto,
    @Body() body: CreateOnlinePaymentIntentDto = {},
  ) {
    return this.onlinePaymentsService.createIntentForCustomer(
      params.sessionId,
      params.billId,
      body ?? {},
    );
  }

  @Get("customer/sessions/:sessionId/online-payment-intents/:intentId")
  @UseGuards(CustomerSessionAccessGuard, PaymentRateLimitGuard)
  @PaymentRateLimit("customer_read")
  findIntentForCustomer(@Param() params: CustomerOnlinePaymentIntentParamDto) {
    return this.onlinePaymentsService.findIntentForCustomer(
      params.sessionId,
      params.intentId,
    );
  }

  @Get("branches/:branchId/online-payments")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("online_payments.read", { branchIdParam: "branchId" })
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchOnlinePaymentsQueryDto = {},
  ) {
    return this.onlinePaymentsService.findForBranch(
      params.branchId,
      query ?? {},
    );
  }

  @Post("branches/:branchId/online-payment-reconciliation/provider")
  @UseGuards(
    StaffSessionGuard,
    StaffPermissionGuard,
    StaffPaymentOperationRateLimitGuard,
  )
  @RequiredPermission("online_payments.manage", { branchIdParam: "branchId" })
  runProviderReconciliation(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BranchIdParamDto,
    @Body() body: StartOnlinePaymentReconciliationDto,
  ) {
    return this.paymentReconciliationService.runPaymobProviderReconciliation(
      params.branchId,
      currentStaff.staffUser.id,
      body,
    );
  }

  @Post("branches/:branchId/online-payment-settlements/import")
  @UseGuards(
    StaffSessionGuard,
    StaffPermissionGuard,
    StaffPaymentOperationRateLimitGuard,
  )
  @RequiredPermission("online_payments.manage", { branchIdParam: "branchId" })
  importSettlementBatch(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BranchIdParamDto,
    @Body() body: ImportOnlinePaymentSettlementDto,
  ) {
    return this.paymentReconciliationService.importSettlementBatch(
      params.branchId,
      currentStaff.staffUser.id,
      body,
    );
  }

  @Get("branches/:branchId/online-payment-reconciliation/runs")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("online_payments.read", { branchIdParam: "branchId" })
  findReconciliationRuns(
    @Param() params: BranchIdParamDto,
    @Query() query: ReconciliationRunsQueryDto = {},
  ) {
    return this.paymentReconciliationService.findRunsForBranch(
      params.branchId,
      query.limit,
    );
  }

  @Get("branches/:branchId/online-payment-reconciliation/issues")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("online_payments.read", { branchIdParam: "branchId" })
  findReconciliationIssues(
    @Param() params: BranchIdParamDto,
    @Query() query: ReconciliationIssuesQueryDto = {},
  ) {
    return this.paymentReconciliationService.findIssuesForBranch(
      params.branchId,
      query,
    );
  }

  @Get("online-payment-reconciliation/runs/:runId")
  @UseGuards(StaffSessionGuard)
  async findReconciliationRun(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentReconciliationRunIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentReconciliationRun(
      currentStaff.staffUser.id,
      "online_payments.read",
      params.runId,
    );

    return this.paymentReconciliationService.findRun(params.runId);
  }

  @Get("online-payment-settlements/:batchId")
  @UseGuards(StaffSessionGuard)
  async findSettlementBatch(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentSettlementBatchIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentSettlementBatch(
      currentStaff.staffUser.id,
      "online_payments.read",
      params.batchId,
    );

    return this.paymentReconciliationService.findSettlementBatch(
      params.batchId,
    );
  }

  @Post("online-payment-reconciliation/issues/:issueId/acknowledge")
  @UseGuards(StaffSessionGuard, StaffPaymentOperationRateLimitGuard)
  async acknowledgeReconciliationIssue(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentReconciliationIssueIdParamDto,
    @Body() body: ReconciliationIssueActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentReconciliationIssue(
      currentStaff.staffUser.id,
      "online_payments.manage",
      params.issueId,
    );

    return this.paymentReconciliationService.acknowledgeIssue(
      params.issueId,
      currentStaff.staffUser.id,
      body ?? {},
    );
  }

  @Post("online-payment-reconciliation/issues/:issueId/resolve")
  @UseGuards(StaffSessionGuard, StaffPaymentOperationRateLimitGuard)
  async resolveReconciliationIssue(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentReconciliationIssueIdParamDto,
    @Body() body: ReconciliationIssueActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentReconciliationIssue(
      currentStaff.staffUser.id,
      "online_payments.manage",
      params.issueId,
    );

    return this.paymentReconciliationService.resolveIssue(
      params.issueId,
      currentStaff.staffUser.id,
      body ?? {},
    );
  }

  @Get("online-payment-intents/:intentId")
  @UseGuards(StaffSessionGuard)
  async findOne(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentIntentIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentIntent(
      currentStaff.staffUser.id,
      "online_payments.read",
      params.intentId,
    );

    return this.onlinePaymentsService.findOne(params.intentId);
  }

  @Post("online-payment-intents/:intentId/refund")
  @UseGuards(StaffSessionGuard, StaffPaymentOperationRateLimitGuard)
  async refundPaymobIntent(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentIntentIdParamDto,
    @Body() body: RefundOnlinePaymentDto,
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentIntent(
      currentStaff.staffUser.id,
      "online_payments.manage",
      params.intentId,
    );

    return this.onlinePaymentsService.refundPaymobIntent(
      params.intentId,
      currentStaff.staffUser.id,
      body,
    );
  }

  @Post("online-payment-intents/:intentId/void")
  @UseGuards(StaffSessionGuard, StaffPaymentOperationRateLimitGuard)
  async voidPaymobIntent(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentIntentIdParamDto,
    @Body() body: VoidOnlinePaymentDto,
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentIntent(
      currentStaff.staffUser.id,
      "online_payments.manage",
      params.intentId,
    );

    return this.onlinePaymentsService.voidPaymobIntent(
      params.intentId,
      currentStaff.staffUser.id,
      body,
    );
  }

  @Post("online-payment-intents/:intentId/capture")
  @UseGuards(StaffSessionGuard, StaffPaymentOperationRateLimitGuard)
  async capturePaymobIntent(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentIntentIdParamDto,
    @Body() body: CaptureOnlinePaymentDto,
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentIntent(
      currentStaff.staffUser.id,
      "online_payments.manage",
      params.intentId,
    );

    return this.onlinePaymentsService.capturePaymobIntent(
      params.intentId,
      currentStaff.staffUser.id,
      body,
    );
  }

  @Post("online-payment-operations/:operationId/recover")
  @UseGuards(StaffSessionGuard, StaffPaymentOperationRateLimitGuard)
  async recoverPaymobOperation(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentOperationIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentOperation(
      currentStaff.staffUser.id,
      "online_payments.manage",
      params.operationId,
    );

    return this.onlinePaymentsService.recoverPaymobOperation(
      params.operationId,
      "staff_manual",
    );
  }

  @Post("online-payment-intents/:intentId/recover")
  @UseGuards(StaffSessionGuard, StaffPaymentRecoveryRateLimitGuard)
  async recoverPaymobIntent(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OnlinePaymentIntentIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForOnlinePaymentIntent(
      currentStaff.staffUser.id,
      "online_payments.manage",
      params.intentId,
    );

    return this.onlinePaymentsService.recoverPaymobIntent(
      params.intentId,
      "staff_manual",
    );
  }

  @Post("online-payments/mock/:intentId/succeed")
  mockSucceed(@Param() params: OnlinePaymentIntentIdParamDto) {
    return this.onlinePaymentsService.mockSucceed(params.intentId);
  }

  @Post("online-payments/mock/:intentId/fail")
  mockFail(
    @Param() params: OnlinePaymentIntentIdParamDto,
    @Body() body: FailOnlinePaymentDto = {},
  ) {
    return this.onlinePaymentsService.mockFail(params.intentId, body ?? {});
  }

  @Post("online-payments/webhooks/mock")
  processMockWebhook(@Body() body: MockOnlinePaymentWebhookDto) {
    return this.onlinePaymentsService.processMockWebhook(body);
  }

  @Post("online-payments/webhooks/paymob")
  processPaymobWebhook(
    @Query() query: PaymobTransactionWebhookQueryDto,
    @Body() body: PaymobTransactionWebhookDto,
  ) {
    return this.onlinePaymentsService.processPaymobWebhook(
      query.hmac,
      body.obj,
    );
  }
}
