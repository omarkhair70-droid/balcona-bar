import { Module } from "@nestjs/common";
import { SmokeBootstrapService } from "./smoke-bootstrap.service";
import { SmokeController } from "./smoke.controller";
import { SmokeResetService } from "./smoke-reset.service";

@Module({
  controllers: [SmokeController],
  providers: [SmokeBootstrapService, SmokeResetService],
})
export class SmokeModule {}
