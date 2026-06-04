import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import { BranchPrintJobsQueryDto } from './dto/branch-print-jobs-query.dto';
import { MarkPrintJobFailedDto } from './dto/print-job-action.dto';
import { PrintJobIdParamDto } from './dto/print-job-param.dto';
import { PrintJobsService } from './print-jobs.service';

@Controller()
export class PrintJobsController {
  constructor(
    private readonly printJobsService: PrintJobsService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('branches/:branchId/print-jobs')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('preparation.read', { branchIdParam: 'branchId' })
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchPrintJobsQueryDto,
  ) {
    return this.printJobsService.findForBranch(params.branchId, query ?? {});
  }

  @Get('print-jobs/:printJobId')
  @UseGuards(StaffSessionGuard)
  async findOne(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PrintJobIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPrintJob(
      currentStaff.staffUser.id,
      'preparation.read',
      params.printJobId,
    );

    return this.printJobsService.findOne(params.printJobId);
  }

  @Post('print-jobs/:printJobId/mark-printing')
  @UseGuards(StaffSessionGuard)
  async markPrinting(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PrintJobIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPrintJob(
      currentStaff.staffUser.id,
      'preparation.start',
      params.printJobId,
    );

    return this.printJobsService.markPrinting(
      params.printJobId,
      currentStaff.staffUser.id,
    );
  }

  @Post('print-jobs/:printJobId/mark-printed')
  @UseGuards(StaffSessionGuard)
  async markPrinted(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PrintJobIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPrintJob(
      currentStaff.staffUser.id,
      'preparation.ready',
      params.printJobId,
    );

    return this.printJobsService.markPrinted(
      params.printJobId,
      currentStaff.staffUser.id,
    );
  }

  @Post('print-jobs/:printJobId/mark-failed')
  @UseGuards(StaffSessionGuard)
  async markFailed(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PrintJobIdParamDto,
    @Body() body: MarkPrintJobFailedDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForPrintJob(
      currentStaff.staffUser.id,
      'preparation.cancel',
      params.printJobId,
    );

    return this.printJobsService.markFailed(
      params.printJobId,
      body.errorMessage,
      currentStaff.staffUser.id,
    );
  }

  @Post('print-jobs/:printJobId/retry')
  @UseGuards(StaffSessionGuard)
  async retry(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PrintJobIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPrintJob(
      currentStaff.staffUser.id,
      'preparation.start',
      params.printJobId,
    );

    return this.printJobsService.retry(
      params.printJobId,
      currentStaff.staffUser.id,
    );
  }
}
