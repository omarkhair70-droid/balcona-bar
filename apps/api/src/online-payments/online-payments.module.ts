import { Module } from "@nestjs/common";
import { BillsModule } from "../bills/bills.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeEventsModule } from "../realtime-events/realtime-events.module";
import { SaasModule } from "../saas/saas.module";
import { StaffModule } from "../staff/staff.module";
import { OnlinePaymentsController } from "./online-payments.controller";
import { OnlinePaymentsService } from "./online-payments.service";

@Module({
  imports: [
    PrismaModule,
    BillsModule,
    RealtimeEventsModule,
    SaasModule,
    StaffModule,
  ],
  controllers: [OnlinePaymentsController],
  providers: [OnlinePaymentsService],
  exports: [OnlinePaymentsService],
})
export class OnlinePaymentsModule {}
