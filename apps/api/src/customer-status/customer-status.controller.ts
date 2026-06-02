import { Controller, Get, Param } from '@nestjs/common';
import { OrderIdParamDto } from '../orders/dto/order-id-param.dto';
import { SessionIdParamDto } from '../table-sessions/dto/session-id-param.dto';
import { CustomerStatusService } from './customer-status.service';

@Controller()
export class CustomerStatusController {
  constructor(private readonly customerStatusService: CustomerStatusService) {}

  @Get('orders/:orderId/customer-status')
  findOrderCustomerStatus(@Param() params: OrderIdParamDto) {
    return this.customerStatusService.findOrderCustomerStatus(params.orderId);
  }

  @Get('table-sessions/:sessionId/customer-status')
  findTableSessionCustomerStatus(@Param() params: SessionIdParamDto) {
    return this.customerStatusService.findTableSessionCustomerStatus(
      params.sessionId,
    );
  }

  @Get('table-sessions/:sessionId/customer-timeline')
  findTableSessionCustomerTimeline(@Param() params: SessionIdParamDto) {
    return this.customerStatusService.findTableSessionCustomerTimeline(
      params.sessionId,
    );
  }
}
