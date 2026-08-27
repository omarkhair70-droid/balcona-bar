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
import { OnlinePaymentIntentIdParamDto } from "./dto/online-payment-id-param.dto";
import {
  PaymobTransactionWebhookDto,
  PaymobTransactionWebhookQueryDto,
} from "./dto/paymob-transaction-webhook.dto";
import { OnlinePaymentsService } from "./online-payments.service";
import { PaymentRateLimit } from "./payment-rate-limit.decorator";
import { PaymentRateLimitGuard } from "./payment-rate-limit.guard";

@Controller()
export class OnlinePaymentsController {
  constructor(
    private readonly onlinePaymentsService: OnlinePaymentsService,
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
