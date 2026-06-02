import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { SessionIdParamDto } from '../cart/dto/session-id-param.dto';
import { CashierAcceptOrderDto } from './dto/cashier-accept-order.dto';
import { CashierOrdersQueryDto } from './dto/cashier-orders-query.dto';
import { CashierRejectOrderDto } from './dto/cashier-reject-order.dto';
import { OrderLifecycleActionDto } from './dto/order-lifecycle-action.dto';
import { OrderIdParamDto } from './dto/order-id-param.dto';
import { SubmitCartDto } from './dto/submit-cart.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
  findCashierOrders(
    @Param() params: BranchIdParamDto,
    @Query() query: CashierOrdersQueryDto,
  ) {
    return this.ordersService.findCashierOrders(params.branchId, query ?? {});
  }

  @Get('orders/:orderId')
  findOne(@Param() params: OrderIdParamDto) {
    return this.ordersService.findOne(params.orderId);
  }

  @Post('orders/:orderId/cashier/accept')
  accept(
    @Param() params: OrderIdParamDto,
    @Body() body: CashierAcceptOrderDto = {},
  ) {
    return this.ordersService.accept(params.orderId, body ?? {});
  }

  @Post('orders/:orderId/cashier/reject')
  reject(
    @Param() params: OrderIdParamDto,
    @Body() body: CashierRejectOrderDto = {},
  ) {
    return this.ordersService.reject(params.orderId, body ?? {});
  }

  @Post('orders/:orderId/serve')
  serve(
    @Param() params: OrderIdParamDto,
    @Body() body: OrderLifecycleActionDto = {},
  ) {
    return this.ordersService.serve(params.orderId, body ?? {});
  }

  @Post('orders/:orderId/complete')
  complete(
    @Param() params: OrderIdParamDto,
    @Body() body: OrderLifecycleActionDto = {},
  ) {
    return this.ordersService.complete(params.orderId, body ?? {});
  }

  @Get('table-sessions/:sessionId/orders')
  findForTableSession(@Param() params: SessionIdParamDto) {
    return this.ordersService.findForTableSession(params.sessionId);
  }
}
