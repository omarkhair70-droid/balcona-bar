import { Body, Controller, Headers, Post } from "@nestjs/common";
import { SmokeBootstrapDto } from "./dto/smoke-bootstrap.dto";
import { SmokeBootstrapService } from "./smoke-bootstrap.service";
import { SmokeResetService } from "./smoke-reset.service";

@Controller("smoke")
export class SmokeController {
  constructor(
    private readonly smokeBootstrapService: SmokeBootstrapService,
    private readonly smokeResetService: SmokeResetService,
  ) {}

  @Post("bootstrap")
  bootstrap(
    @Body() body: SmokeBootstrapDto,
    @Headers("x-smoke-bootstrap-token") smokeBootstrapToken: string | undefined,
    @Headers("authorization") authorization: string | undefined,
  ) {
    return this.smokeBootstrapService.bootstrap(
      body,
      this.extractToken(smokeBootstrapToken, authorization),
    );
  }

  @Post("reset")
  reset(
    @Headers("x-smoke-bootstrap-token") smokeBootstrapToken: string | undefined,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-request-id") requestId: string | undefined,
  ) {
    return this.smokeResetService.reset(
      this.extractToken(smokeBootstrapToken, authorization),
      requestId,
    );
  }

  private extractToken(
    smokeBootstrapToken: string | undefined,
    authorization: string | undefined,
  ) {
    if (smokeBootstrapToken) {
      return smokeBootstrapToken;
    }

    const [scheme, token] = authorization?.split(/\s+/, 2) ?? [];

    return scheme?.toLowerCase() === "bearer" ? token : undefined;
  }
}
