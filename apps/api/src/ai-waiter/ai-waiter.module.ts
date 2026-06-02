import { Module } from "@nestjs/common";
import { AutopilotModule } from "../autopilot/autopilot.module";
import { CartModule } from "../cart/cart.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RealtimeEventsModule } from "../realtime-events/realtime-events.module";
import { WaiterCallsModule } from "../waiter-calls/waiter-calls.module";
import { AiWaiterContextService } from "./ai-waiter-context.service";
import { AiWaiterController } from "./ai-waiter.controller";
import { AiWaiterService } from "./ai-waiter.service";
import { AiWaiterStubProviderService } from "./ai-waiter-stub-provider.service";

@Module({
  imports: [
    PrismaModule,
    AutopilotModule,
    CartModule,
    RealtimeEventsModule,
    WaiterCallsModule,
  ],
  controllers: [AiWaiterController],
  providers: [
    AiWaiterService,
    AiWaiterContextService,
    AiWaiterStubProviderService,
  ],
})
export class AiWaiterModule {}
