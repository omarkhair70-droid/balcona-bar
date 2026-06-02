import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { JobsService } from './jobs.service';

@Controller('system/jobs')
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('health')
  @RequiredPermission('system.jobs.read')
  health() {
    return this.jobsService.health();
  }

  @Get('queues')
  @RequiredPermission('system.jobs.read')
  queues() {
    return this.jobsService.queuesStatus();
  }
}

