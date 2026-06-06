import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PlatformSessionGuard } from "./guards/platform-session.guard";
import { PlatformAuthController } from "./platform-auth.controller";
import { PlatformAuthService } from "./platform-auth.service";

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PlatformAuthController],
  providers: [PlatformAuthService, PlatformSessionGuard],
  exports: [PlatformAuthService, PlatformSessionGuard],
})
export class PlatformAuthModule {}
