import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import {
  AdjustInventoryLevelDto,
  CreateInventoryItemDto,
  ReplaceMenuItemInventoryRequirementsDto,
  UpdateInventoryItemDto,
} from './dto/inventory.dto';
import {
  BranchIdParamDto,
  BranchInventoryItemParamDto,
  CompanyIdParamDto,
  InventoryItemIdParamDto,
  MenuItemIdParamDto,
} from './dto/inventory-param.dto';
import { InventoryService } from './inventory.service';

@Controller()
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('companies/:companyId/inventory/items')
  @RequiredPermission('inventory.read', { companyIdParam: 'companyId' })
  listInventoryItems(@Param() params: CompanyIdParamDto) {
    return this.inventoryService.listInventoryItems(params.companyId);
  }

  @Post('companies/:companyId/inventory/items')
  @RequiredPermission('inventory.manage', { companyIdParam: 'companyId' })
  createInventoryItem(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateInventoryItemDto,
  ) {
    return this.inventoryService.createInventoryItem(params.companyId, body);
  }

  @Patch('inventory/items/:inventoryItemId')
  async updateInventoryItem(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: InventoryItemIdParamDto,
    @Body() body: UpdateInventoryItemDto,
  ) {
    await this.staffScopedAccessService.assertCanForInventoryItem(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.inventoryItemId,
    );

    return this.inventoryService.updateInventoryItem(params.inventoryItemId, body);
  }

  @Get('branches/:branchId/inventory/levels')
  @RequiredPermission('inventory.read', { branchIdParam: 'branchId' })
  getBranchInventoryLevels(@Param() params: BranchIdParamDto) {
    return this.inventoryService.getBranchInventoryLevels(params.branchId);
  }

  @Get('branches/:branchId/inventory/alerts')
  @RequiredPermission('inventory.read', { branchIdParam: 'branchId' })
  getBranchInventoryAlerts(@Param() params: BranchIdParamDto) {
    return this.inventoryService.getBranchInventoryAlerts(params.branchId);
  }

  @Post('branches/:branchId/inventory/levels/:inventoryItemId/adjust')
  @RequiredPermission('inventory.manage', { branchIdParam: 'branchId' })
  adjustBranchInventoryLevel(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BranchInventoryItemParamDto,
    @Body() body: AdjustInventoryLevelDto,
  ) {
    return this.inventoryService.adjustBranchInventoryLevel(
      params.branchId,
      params.inventoryItemId,
      body,
      currentStaff.staffUser.id,
    );
  }

  @Get('menu-items/:menuItemId/inventory-requirements')
  async getMenuItemInventoryRequirements(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MenuItemIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'inventory.read',
      params.menuItemId,
    );

    return this.inventoryService.getMenuItemInventoryRequirements(params.menuItemId);
  }

  @Put('menu-items/:menuItemId/inventory-requirements')
  async replaceMenuItemInventoryRequirements(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: MenuItemIdParamDto,
    @Body() body: ReplaceMenuItemInventoryRequirementsDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.menuItemId,
    );

    return this.inventoryService.replaceMenuItemInventoryRequirements(
      params.menuItemId,
      body,
    );
  }

  @Get('branches/:branchId/inventory/menu-availability')
  @RequiredPermission('inventory.read', { branchIdParam: 'branchId' })
  getBranchMenuAvailability(@Param() params: BranchIdParamDto) {
    return this.inventoryService.getBranchMenuAvailability(params.branchId);
  }
}
