import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StaffModule } from "../staff/staff.module";
import { SaasController } from "./saas.controller";
import { SaasBillingService } from "./saas-billing.service";
import { SaasService } from "./saas.service";

@Module({
  imports: [AuditModule, PrismaModule, StaffModule],
  controllers: [SaasController],
  providers: [SaasService, SaasBillingService],
  exports: [SaasService, SaasBillingService],
})
export class SaasModule {}
