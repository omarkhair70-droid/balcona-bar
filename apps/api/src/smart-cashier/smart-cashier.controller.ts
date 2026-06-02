import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { BranchIdParamDto } from '../branches/dto/branch-id-param.dto';
import { OrderIdParamDto } from '../orders/dto/order-id-param.dto';
import { CreateSmartCashierReviewRuleDto } from './dto/create-smart-cashier-review-rule.dto';
import { SmartCashierRuleIdParamDto } from './dto/smart-cashier-rule-id-param.dto';
import { UpdateSmartCashierReviewRuleDto } from './dto/update-smart-cashier-review-rule.dto';
import { UpsertBranchSmartCashierSettingsDto } from './dto/upsert-branch-smart-cashier-settings.dto';
import { SmartCashierService } from './smart-cashier.service';

@Controller()
export class SmartCashierController {
  constructor(private readonly smartCashierService: SmartCashierService) {}

  @Get('branches/:branchId/smart-cashier/settings')
  getBranchSettings(@Param() params: BranchIdParamDto) {
    return this.smartCashierService.getBranchSettings(params.branchId);
  }

  @Put('branches/:branchId/smart-cashier/settings')
  upsertBranchSettings(
    @Param() params: BranchIdParamDto,
    @Body() body: UpsertBranchSmartCashierSettingsDto = {},
  ) {
    return this.smartCashierService.upsertBranchSettings(
      params.branchId,
      body ?? {},
    );
  }

  @Post('orders/:orderId/smart-cashier/evaluate')
  evaluateOrder(@Param() params: OrderIdParamDto) {
    return this.smartCashierService.evaluateOrderForAutoAccept(params.orderId);
  }

  @Post('orders/:orderId/smart-cashier/attempt-auto-accept')
  attemptAutoAccept(@Param() params: OrderIdParamDto) {
    return this.smartCashierService.attemptAutoAcceptOrder(params.orderId);
  }

  @Get('branches/:branchId/smart-cashier/review-rules')
  listReviewRules(@Param() params: BranchIdParamDto) {
    return this.smartCashierService.listReviewRules(params.branchId);
  }

  @Post('branches/:branchId/smart-cashier/review-rules')
  createReviewRule(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateSmartCashierReviewRuleDto,
  ) {
    return this.smartCashierService.createReviewRule(params.branchId, body);
  }

  @Patch('smart-cashier/review-rules/:ruleId')
  updateReviewRule(
    @Param() params: SmartCashierRuleIdParamDto,
    @Body() body: UpdateSmartCashierReviewRuleDto,
  ) {
    return this.smartCashierService.updateReviewRule(params.ruleId, body);
  }

  @Post('smart-cashier/review-rules/:ruleId/disable')
  disableReviewRule(@Param() params: SmartCashierRuleIdParamDto) {
    return this.smartCashierService.disableReviewRule(params.ruleId);
  }
}
