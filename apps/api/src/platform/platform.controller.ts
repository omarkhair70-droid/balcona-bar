import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentPlatformAdmin } from "../platform-auth/decorators/current-platform-admin.decorator";
import { PlatformSessionGuard } from "../platform-auth/guards/platform-session.guard";
import { PlatformAuthContext } from "../platform-auth/platform-auth.types";
import { BootstrapPlatformCompanyDto } from "./dto/bootstrap-platform-company.dto";
import { PlatformCompanyIdParamDto } from "./dto/platform-param.dto";
import { UpdatePlatformSubscriptionDto } from "./dto/update-platform-subscription.dto";
import { PlatformService } from "./platform.service";

@Controller("platform")
@UseGuards(PlatformSessionGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get("plans")
  getPlans() {
    return this.platformService.getPlans();
  }

  @Get("companies")
  getCompanies() {
    return this.platformService.listCompanies();
  }

  @Get("companies/:companyId")
  getCompany(@Param() params: PlatformCompanyIdParamDto) {
    return this.platformService.getCompany(params.companyId);
  }

  @Post("companies/bootstrap")
  bootstrapCompany(
    @CurrentPlatformAdmin() currentPlatformAdmin: PlatformAuthContext,
    @Body() body: BootstrapPlatformCompanyDto,
  ) {
    return this.platformService.bootstrapCompany(
      body,
      currentPlatformAdmin.platformAdminUser.id,
    );
  }

  @Patch("companies/:companyId/subscription")
  updateCompanySubscription(
    @CurrentPlatformAdmin() currentPlatformAdmin: PlatformAuthContext,
    @Param() params: PlatformCompanyIdParamDto,
    @Body() body: UpdatePlatformSubscriptionDto,
  ) {
    return this.platformService.updateCompanySubscription(
      params.companyId,
      body,
      currentPlatformAdmin.platformAdminUser.id,
    );
  }
}
