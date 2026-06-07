import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { StaffInvitesController } from "./staff-invites.controller";
import { StaffInvitesService } from "./staff-invites.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [StaffInvitesController],
  providers: [StaffInvitesService],
  exports: [StaffInvitesService],
})
export class StaffInvitesModule {}
