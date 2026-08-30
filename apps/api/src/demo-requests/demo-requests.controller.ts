import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { PlatformSessionGuard } from "../platform-auth/guards/platform-session.guard";
import { DemoRequestRateLimitService } from "./demo-request-rate-limit.service";
import { DemoRequestsService } from "./demo-requests.service";
import { CreateDemoRequestDto } from "./dto/create-demo-request.dto";
import { ListDemoRequestsDto } from "./dto/list-demo-requests.dto";
import { UpdateDemoRequestDto } from "./dto/update-demo-request.dto";

@Controller("public/demo-requests")
export class PublicDemoRequestsController {
  constructor(
    private readonly demoRequests: DemoRequestsService,
    private readonly rateLimit: DemoRequestRateLimitService,
  ) {}

  @Post()
  async create(@Req() request: Request, @Body() body: CreateDemoRequestDto) {
    await this.rateLimit.assertAllowed(`${request.ip}:${body.email}`);
    return this.demoRequests.create(body);
  }
}

@Controller("platform/demo-requests")
@UseGuards(PlatformSessionGuard)
export class PlatformDemoRequestsController {
  constructor(private readonly demoRequests: DemoRequestsService) {}

  @Get()
  list(@Query() query: ListDemoRequestsDto) {
    return this.demoRequests.list(query);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.demoRequests.get(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: UpdateDemoRequestDto) {
    return this.demoRequests.update(id, body);
  }
}
