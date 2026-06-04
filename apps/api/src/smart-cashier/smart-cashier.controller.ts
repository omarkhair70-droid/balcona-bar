import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { CreateSmartCashierReviewRuleDto } from './dto/create-smart-cashier-review-rule.dto';
import { SmartCashierRuleIdParamDto } from './dto/smart-cashier-rule-id-param.dto';
import { UpdateSmartCashierReviewRuleDto } from './dto/update-smart-cashier-review-rule.dto';
import { UpsertBranchSmartCashierSettingsDto } from './dto/upsert-branch-smart-cashier-settings.dto';
import { SmartCashierService } from './smart-cashier.service';

@Controller()
export class SmartCashierController {
  constructor(
    private readonly smartCashierService: SmartCashierService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('branches/:branchId/smart-cashier/settings')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('smart_cashier.read', { branchIdParam: 'branchId' })
  getBranchSettings(@Param() params: BranchIdParamDto) {
    return this.smartCashierService.getBranchSettings(params.branchId);
  }

  @Put('branches/:branchId/smart-cashier/settings')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('smart_cashier.manage', { branchIdParam: 'branchId' })
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
  @UseGuards(StaffSessionGuard)
  async evaluateOrder(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OrderIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForOrder(
      currentStaff.staffUser.id,
      'smart_cashier.evaluate',
      params.orderId,
    );

    return this.smartCashierService.evaluateOrderForAutoAccept(params.orderId);
  }

  @Post('orders/:orderId/smart-cashier/attempt-auto-accept')
  @UseGuards(StaffSessionGuard)
  async attemptAutoAccept(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OrderIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForOrder(
      currentStaff.staffUser.id,
      'smart_cashier.auto_accept',
      params.orderId,
    );

    return this.smartCashierService.attemptAutoAcceptOrder(params.orderId);
  }

  @Get('branches/:branchId/smart-cashier/review-rules')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('smart_cashier.read', { branchIdParam: 'branchId' })
  listReviewRules(@Param() params: BranchIdParamDto) {
    return this.smartCashierService.listReviewRules(params.branchId);
  }

  @Post('branches/:branchId/smart-cashier/review-rules')
  @UseGuards(StaffSessionGuard, StaffPermissionGuard)
  @RequiredPermission('smart_cashier.manage', { branchIdParam: 'branchId' })
  createReviewRule(
    @Param() params: BranchIdParamDto,
    @Body() body: CreateSmartCashierReviewRuleDto,
  ) {
    return this.smartCashierService.createReviewRule(params.branchId, body);
  }

  @Patch('smart-cashier/review-rules/:ruleId')
  @UseGuards(StaffSessionGuard)
  async updateReviewRule(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SmartCashierRuleIdParamDto,
    @Body() body: UpdateSmartCashierReviewRuleDto,
  ) {
    await this.staffScopedAccessService.assertCanForSmartCashierRule(
      currentStaff.staffUser.id,
      'smart_cashier.manage',
      params.ruleId,
    );

    return this.smartCashierService.updateReviewRule(params.ruleId, body);
  }

  @Post('smart-cashier/review-rules/:ruleId/disable')
  @UseGuards(StaffSessionGuard)
  async disableReviewRule(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SmartCashierRuleIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForSmartCashierRule(
      currentStaff.staffUser.id,
      'smart_cashier.manage',
      params.ruleId,
    );

    return this.smartCashierService.disableReviewRule(params.ruleId);
  }
}
