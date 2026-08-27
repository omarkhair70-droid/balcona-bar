import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BillsModule } from "../bills/bills.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeEventsModule } from "../realtime-events/realtime-events.module";
import { SaasModule } from "../saas/saas.module";
import { StaffModule } from "../staff/staff.module";
import { TableSessionsModule } from "../table-sessions/table-sessions.module";
import { OnlinePaymentReconciliationScheduler } from "./online-payment-reconciliation.scheduler";
import { OnlinePaymentsController } from "./online-payments.controller";
import { OnlinePaymentsService } from "./online-payments.service";
import { PaymobPaymentProviderService } from "./providers/paymob-payment-provider.service";
import { PaymentRateLimitGuard } from "./payment-rate-limit.guard";
import { PaymentRateLimitService } from "./payment-rate-limit.service";
import { StaffPaymentRecoveryRateLimitGuard } from "./staff-payment-recovery-rate-limit.guard";

@Module({
  imports: [
    AuditModule,
    PrismaModule,
    BillsModule,
    RealtimeEventsModule,
    SaasModule,
    StaffModule,
    TableSessionsModule,
  ],
  controllers: [OnlinePaymentsController],
  providers: [
    OnlinePaymentsService,
    PaymobPaymentProviderService,
    PaymentRateLimitService,
    PaymentRateLimitGuard,
    OnlinePaymentReconciliationScheduler,
    StaffPaymentRecoveryRateLimitGuard,
  ],
  exports: [OnlinePaymentsService],
})
export class OnlinePaymentsModule {}
