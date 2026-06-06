import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { CurrentPlatformAdmin } from "./decorators/current-platform-admin.decorator";
import { PlatformLoginDto } from "./dto/platform-login.dto";
import { PlatformSessionGuard } from "./guards/platform-session.guard";
import { PlatformAuthService } from "./platform-auth.service";

@Controller("platform-auth")
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Post("login")
  login(@Body() body: PlatformLoginDto, @Req() request: Request) {
    return this.platformAuthService.login(body, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
    });
  }

  @Get("me")
  @UseGuards(PlatformSessionGuard)
  me(@CurrentPlatformAdmin() currentPlatformAdmin: unknown) {
    return currentPlatformAdmin;
  }
}
