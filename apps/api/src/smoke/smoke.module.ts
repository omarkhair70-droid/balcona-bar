import { Module } from "@nestjs/common";
import { SmokeBootstrapService } from "./smoke-bootstrap.service";
import { SmokeController } from "./smoke.controller";

@Module({
  controllers: [SmokeController],
  providers: [SmokeBootstrapService],
})
export class SmokeModule {}
