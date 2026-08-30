import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentStaff } from "../staff-auth/decorators/current-staff.decorator";
import { StaffAuthContext } from "../staff-auth/staff-auth.types";
import { StaffSessionGuard } from "../staff-auth/guards/staff-session.guard";
import { RequiredPermission } from "../staff/required-permission.decorator";
import { StaffPermissionGuard } from "../staff/staff-permission.guard";
import { StaffScopedAccessService } from "../staff/staff-scoped-access.service";
import {
  StartTerminalPaymentRequestDto,
  UpsertPaymentTerminalDto,
} from "./dto/payment-terminal.dto";
import { PaymentTerminalsService } from "./payment-terminals.service";

@Controller()
export class PaymentTerminalsController {
  constructor(
    private readonly paymentTerminalsService: PaymentTerminalsService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get("branches/:branchId/payment-terminals")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("online_payments.read", { branchIdParam: "branchId" })
  listForBranch(@Param("branchId") branchId: string) {
    return this.paymentTerminalsService.listForBranch(branchId);
  }

  @Get("branches/:branchId/terminal-payment-requests")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("online_payments.read", { branchIdParam: "branchId" })
  listRequestsForBranch(@Param("branchId") branchId: string) {
    return this.paymentTerminalsService.listRequestsForBranch(branchId);
  }

  @Post("branches/:branchId/payment-terminals")
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission("online_payments.manage", { branchIdParam: "branchId" })
  upsertForBranch(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param("branchId") branchId: string,
    @Body() body: UpsertPaymentTerminalDto,
  ) {
    return this.paymentTerminalsService.upsertForBranch(
      branchId,
      currentStaff.staffUser.id,
      body,
    );
  }

  @Post("bills/:billId/terminal-payment-requests")
  @UseGuards(StaffSessionGuard)
  async startForBill(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param("billId") billId: string,
    @Body() body: StartTerminalPaymentRequestDto,
  ) {
    await this.staffScopedAccessService.assertCanForBill(
      currentStaff.staffUser.id,
      "bills.pay",
      billId,
    );

    return this.paymentTerminalsService.startForBill(
      billId,
      currentStaff.staffUser.id,
      body,
    );
  }
}
