import { Global, Module } from "@nestjs/common";
import { DeploymentReadinessService } from "./deployment-readiness.service";

@Global()
@Module({
  providers: [DeploymentReadinessService],
  exports: [DeploymentReadinessService],
})
export class DeploymentModule {}
