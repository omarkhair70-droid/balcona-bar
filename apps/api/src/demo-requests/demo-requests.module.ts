import { Module } from "@nestjs/common";
import { PlatformAuthModule } from "../platform-auth/platform-auth.module";
import { DemoRequestRateLimitService } from "./demo-request-rate-limit.service";
import {
  PlatformDemoRequestsController,
  PublicDemoRequestsController,
} from "./demo-requests.controller";
import { DemoRequestsService } from "./demo-requests.service";

@Module({
  imports: [PlatformAuthModule],
  controllers: [PublicDemoRequestsController, PlatformDemoRequestsController],
  providers: [DemoRequestsService, DemoRequestRateLimitService],
  exports: [DemoRequestsService],
})
export class DemoRequestsModule {}
