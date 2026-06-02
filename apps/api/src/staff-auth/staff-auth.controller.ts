import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CurrentStaff } from './decorators/current-staff.decorator';
import { BootstrapPasswordDto } from './dto/bootstrap-password.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { StaffLogoutDto } from './dto/staff-logout.dto';
import { StaffSessionGuard } from './guards/staff-session.guard';
import { StaffAuthService } from './staff-auth.service';

@Controller('staff-auth')
export class StaffAuthController {
  constructor(private readonly staffAuthService: StaffAuthService) {}

  @Post('login')
  login(@Body() body: StaffLoginDto, @Req() request: Request) {
    return this.staffAuthService.login(body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
  }

  @Post('logout')
  logout(@Body() body: StaffLogoutDto = {}, @Req() request: Request) {
    return this.staffAuthService.logout(
      this.extractBearerToken(request) ?? body.token,
    );
  }

  @Get('me')
  @UseGuards(StaffSessionGuard)
  me(@CurrentStaff() currentStaff: unknown) {
    return currentStaff;
  }

  @Post('dev/bootstrap-password')
  bootstrapPassword(@Body() body: BootstrapPasswordDto) {
    return this.staffAuthService.bootstrapPassword(body);
  }

  private extractBearerToken(request: Request) {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }
}

