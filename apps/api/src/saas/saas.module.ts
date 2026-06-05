import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { StaffModule } from "../staff/staff.module";
import { SaasController } from "./saas.controller";
import { SaasService } from "./saas.service";

@Module({
  imports: [PrismaModule, StaffModule],
  controllers: [SaasController],
  providers: [SaasService],
  exports: [SaasService],
})
export class SaasModule {}
