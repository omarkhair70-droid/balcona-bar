import { Module } from "@nestjs/common";
import { PlatformAuthModule } from "../platform-auth/platform-auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SaasModule } from "../saas/saas.module";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  imports: [PrismaModule, SaasModule, PlatformAuthModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
