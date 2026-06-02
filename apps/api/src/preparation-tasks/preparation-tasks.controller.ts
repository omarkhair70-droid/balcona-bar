import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { OrderIdParamDto } from '../orders/dto/order-id-param.dto';
import { BranchPreparationTasksQueryDto } from './dto/branch-preparation-tasks-query.dto';
import { CancelPreparationTaskDto } from './dto/cancel-preparation-task.dto';
import { PreparationTaskActionDto } from './dto/preparation-task-action.dto';
import { PreparationTaskIdParamDto } from './dto/preparation-task-id-param.dto';
import { PreparationTasksService } from './preparation-tasks.service';

@Controller()
export class PreparationTasksController {
  constructor(
    private readonly preparationTasksService: PreparationTasksService,
  ) {}

  @Get('branches/:branchId/preparation-tasks')
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
  findForOrder(@Param() params: OrderIdParamDto) {
    return this.preparationTasksService.findForOrder(params.orderId);
  }

  @Get('preparation-tasks/:taskId')
  findOne(@Param() params: PreparationTaskIdParamDto) {
    return this.preparationTasksService.findOne(params.taskId);
  }

  @Post('preparation-tasks/:taskId/start')
  start(
    @Param() params: PreparationTaskIdParamDto,
    @Body() body: PreparationTaskActionDto = {},
  ) {
    return this.preparationTasksService.start(params.taskId, body ?? {});
  }

  @Post('preparation-tasks/:taskId/ready')
  markReady(
    @Param() params: PreparationTaskIdParamDto,
    @Body() body: PreparationTaskActionDto = {},
  ) {
    return this.preparationTasksService.markReady(params.taskId, body ?? {});
  }

  @Post('preparation-tasks/:taskId/cancel')
  cancel(
    @Param() params: PreparationTaskIdParamDto,
    @Body() body: CancelPreparationTaskDto = {},
  ) {
    return this.preparationTasksService.cancel(params.taskId, body ?? {});
  }
}
