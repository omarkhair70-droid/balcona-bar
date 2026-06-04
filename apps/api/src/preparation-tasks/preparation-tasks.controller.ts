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
import { OrderIdParamDto } from '../orders/dto/order-id-param.dto';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import { BranchPreparationTasksQueryDto } from './dto/branch-preparation-tasks-query.dto';
import { CancelPreparationTaskDto } from './dto/cancel-preparation-task.dto';
import { PreparationTaskActionDto } from './dto/preparation-task-action.dto';
import { PreparationTaskIdParamDto } from './dto/preparation-task-id-param.dto';
import { PreparationTasksService } from './preparation-tasks.service';

@Controller()
export class PreparationTasksController {
  constructor(
    private readonly preparationTasksService: PreparationTasksService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('branches/:branchId/preparation-tasks')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('preparation.read', { branchIdParam: 'branchId' })
  findForBranch(
    @Param() params: BranchIdParamDto,
    @Query() query: BranchPreparationTasksQueryDto,
  ) {
    return this.preparationTasksService.findForBranch(
      params.branchId,
      query ?? {},
    );
  }

  @Get('orders/:orderId/preparation-tasks')
  @UseGuards(StaffSessionGuard)
  async findForOrder(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OrderIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForOrder(
      currentStaff.staffUser.id,
      'preparation.read',
      params.orderId,
    );

    return this.preparationTasksService.findForOrder(params.orderId);
  }

  @Get('preparation-tasks/:taskId')
  @UseGuards(StaffSessionGuard)
  async findOne(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PreparationTaskIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPreparationTask(
      currentStaff.staffUser.id,
      'preparation.read',
      params.taskId,
    );

    return this.preparationTasksService.findOne(params.taskId);
  }

  @Post('preparation-tasks/:taskId/start')
  @UseGuards(StaffSessionGuard)
  async start(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PreparationTaskIdParamDto,
    @Body() body: PreparationTaskActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForPreparationTask(
      currentStaff.staffUser.id,
      'preparation.start',
      params.taskId,
    );

    return this.preparationTasksService.start(params.taskId, {
      ...(body ?? {}),
      staffUserId: currentStaff.staffUser.id,
    });
  }

  @Post('preparation-tasks/:taskId/ready')
  @UseGuards(StaffSessionGuard)
  async markReady(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PreparationTaskIdParamDto,
    @Body() body: PreparationTaskActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForPreparationTask(
      currentStaff.staffUser.id,
      'preparation.ready',
      params.taskId,
    );

    return this.preparationTasksService.markReady(params.taskId, {
      ...(body ?? {}),
      staffUserId: currentStaff.staffUser.id,
    });
  }

  @Post('preparation-tasks/:taskId/cancel')
  @UseGuards(StaffSessionGuard)
  async cancel(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PreparationTaskIdParamDto,
    @Body() body: CancelPreparationTaskDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForPreparationTask(
      currentStaff.staffUser.id,
      'preparation.cancel',
      params.taskId,
    );

    return this.preparationTasksService.cancel(params.taskId, {
      ...(body ?? {}),
      staffUserId: currentStaff.staffUser.id,
    });
  }
}
