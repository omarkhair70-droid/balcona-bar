import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { SessionIdParamDto } from '../cart/dto/session-id-param.dto';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import { CashierAcceptOrderDto } from './dto/cashier-accept-order.dto';
import { CashierOrdersQueryDto } from './dto/cashier-orders-query.dto';
import { CashierRejectOrderDto } from './dto/cashier-reject-order.dto';
import { OrderLifecycleActionDto } from './dto/order-lifecycle-action.dto';
import { OrderIdParamDto } from './dto/order-id-param.dto';
import { SubmitCartDto } from './dto/submit-cart.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Post('table-sessions/:sessionId/cart/submit')
  submitCart(
    @Param() params: SessionIdParamDto,
    @Body() body: SubmitCartDto = {},
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.submitCart(
      params.sessionId,
      body ?? {},
      idempotencyKey,
    );
  }

  @Get('branches/:branchId/cashier/orders')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('orders.cashier_review', { branchIdParam: 'branchId' })
  findCashierOrders(
    @Param() params: BranchIdParamDto,
    @Query() query: CashierOrdersQueryDto,
  ) {
    return this.ordersService.findCashierOrders(params.branchId, query ?? {});
  }

  @Get('orders/:orderId')
  @UseGuards(StaffSessionGuard)
  async findOne(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OrderIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForOrder(
      currentStaff.staffUser.id,
      'orders.read',
      params.orderId,
    );

    return this.ordersService.findOne(params.orderId);
  }

  @Post('orders/:orderId/cashier/accept')
  @UseGuards(StaffSessionGuard)
  async accept(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OrderIdParamDto,
    @Body() body: CashierAcceptOrderDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForOrder(
      currentStaff.staffUser.id,
      'orders.accept',
      params.orderId,
    );

    return this.ordersService.accept(params.orderId, body ?? {});
  }

  @Post('orders/:orderId/cashier/reject')
  @UseGuards(StaffSessionGuard)
  async reject(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OrderIdParamDto,
    @Body() body: CashierRejectOrderDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForOrder(
      currentStaff.staffUser.id,
      'orders.reject',
      params.orderId,
    );

    return this.ordersService.reject(params.orderId, body ?? {});
  }

  @Post('orders/:orderId/serve')
  @UseGuards(StaffSessionGuard)
  async serve(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OrderIdParamDto,
    @Body() body: OrderLifecycleActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForOrder(
      currentStaff.staffUser.id,
      'orders.serve',
      params.orderId,
    );

    return this.ordersService.serve(params.orderId, body ?? {});
  }

  @Post('orders/:orderId/complete')
  @UseGuards(StaffSessionGuard)
  async complete(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OrderIdParamDto,
    @Body() body: OrderLifecycleActionDto = {},
  ) {
    await this.staffScopedAccessService.assertCanForOrder(
      currentStaff.staffUser.id,
      'orders.complete',
      params.orderId,
    );

    return this.ordersService.complete(params.orderId, body ?? {});
  }

  @Get('table-sessions/:sessionId/orders')
  findForTableSession(@Param() params: SessionIdParamDto) {
    return this.ordersService.findForTableSession(params.sessionId);
  }
}
