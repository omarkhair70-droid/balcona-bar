import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import {
  AdjustInventoryLevelDto,
  CreateInventoryItemDto,
  CreatePurchaseOrderDto,
  CreatePurchaseOrderLineDto,
  CreateSupplierDto,
  ReceivePurchaseOrderDto,
  ReplaceMenuItemInventoryRequirementsDto,
  UpdateInventoryItemDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderLineDto,
  UpdateSupplierDto,
} from './dto/inventory.dto';
import {
  BranchIdParamDto,
  BranchInventoryItemParamDto,
  CompanyIdParamDto,
  InventoryItemIdParamDto,
  MenuItemIdParamDto,
  PurchaseOrderIdParamDto,
  PurchaseOrderLineIdParamDto,
  SupplierIdParamDto,
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

  @Get('companies/:companyId/suppliers')
  @RequiredPermission('inventory.read', { companyIdParam: 'companyId' })
  listSuppliers(@Param() params: CompanyIdParamDto) {
    return this.inventoryService.listSuppliers(params.companyId);
  }

  @Get('branches/:branchId/suppliers')
  @RequiredPermission('inventory.read', { branchIdParam: 'branchId' })
  listBranchSuppliers(@Param() params: BranchIdParamDto) {
    return this.inventoryService.listBranchSuppliers(params.branchId);
  }

  @Post('companies/:companyId/suppliers')
  @RequiredPermission('inventory.manage', { companyIdParam: 'companyId' })
  createSupplier(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateSupplierDto,
  ) {
    return this.inventoryService.createSupplier(params.companyId, body);
  }

  @Patch('suppliers/:supplierId')
  async updateSupplier(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: SupplierIdParamDto,
    @Body() body: UpdateSupplierDto,
  ) {
    await this.staffScopedAccessService.assertCanForSupplier(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.supplierId,
    );

    return this.inventoryService.updateSupplier(params.supplierId, body);
  }

  @Get('branches/:branchId/purchase-orders')
  @RequiredPermission('inventory.read', { branchIdParam: 'branchId' })
  listPurchaseOrders(@Param() params: BranchIdParamDto) {
    return this.inventoryService.listPurchaseOrders(params.branchId);
  }

  @Post('branches/:branchId/purchase-orders')
  @RequiredPermission('inventory.manage', { branchIdParam: 'branchId' })
  createPurchaseOrder(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: BranchIdParamDto,
    @Body() body: CreatePurchaseOrderDto,
  ) {
    return this.inventoryService.createPurchaseOrder(
      params.branchId,
      body,
      currentStaff.staffUser.id,
    );
  }

  @Get('purchase-orders/:purchaseOrderId')
  async getPurchaseOrder(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PurchaseOrderIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPurchaseOrder(
      currentStaff.staffUser.id,
      'inventory.read',
      params.purchaseOrderId,
    );

    return this.inventoryService.getPurchaseOrder(params.purchaseOrderId);
  }

  @Patch('purchase-orders/:purchaseOrderId')
  async updatePurchaseOrder(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PurchaseOrderIdParamDto,
    @Body() body: UpdatePurchaseOrderDto,
  ) {
    await this.staffScopedAccessService.assertCanForPurchaseOrder(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.purchaseOrderId,
    );

    return this.inventoryService.updatePurchaseOrder(
      params.purchaseOrderId,
      body,
    );
  }

  @Post('purchase-orders/:purchaseOrderId/submit')
  async submitPurchaseOrder(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PurchaseOrderIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPurchaseOrder(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.purchaseOrderId,
    );

    return this.inventoryService.submitPurchaseOrder(params.purchaseOrderId);
  }

  @Post('purchase-orders/:purchaseOrderId/cancel')
  async cancelPurchaseOrder(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PurchaseOrderIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPurchaseOrder(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.purchaseOrderId,
    );

    return this.inventoryService.cancelPurchaseOrder(params.purchaseOrderId);
  }

  @Post('purchase-orders/:purchaseOrderId/lines')
  async addPurchaseOrderLine(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PurchaseOrderIdParamDto,
    @Body() body: CreatePurchaseOrderLineDto,
  ) {
    await this.staffScopedAccessService.assertCanForPurchaseOrder(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.purchaseOrderId,
    );

    return this.inventoryService.addPurchaseOrderLine(
      params.purchaseOrderId,
      body,
    );
  }

  @Patch('purchase-orders/:purchaseOrderId/lines/:purchaseOrderLineId')
  async updatePurchaseOrderLine(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PurchaseOrderLineIdParamDto,
    @Body() body: UpdatePurchaseOrderLineDto,
  ) {
    await this.staffScopedAccessService.assertCanForPurchaseOrder(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.purchaseOrderId,
    );

    return this.inventoryService.updatePurchaseOrderLine(
      params.purchaseOrderId,
      params.purchaseOrderLineId,
      body,
    );
  }

  @Delete('purchase-orders/:purchaseOrderId/lines/:purchaseOrderLineId')
  async removePurchaseOrderLine(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PurchaseOrderLineIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForPurchaseOrder(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.purchaseOrderId,
    );

    return this.inventoryService.removePurchaseOrderLine(
      params.purchaseOrderId,
      params.purchaseOrderLineId,
    );
  }

  @Post('purchase-orders/:purchaseOrderId/receipts')
  async receivePurchaseOrder(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: PurchaseOrderIdParamDto,
    @Body() body: ReceivePurchaseOrderDto,
  ) {
    await this.staffScopedAccessService.assertCanForPurchaseOrder(
      currentStaff.staffUser.id,
      'inventory.manage',
      params.purchaseOrderId,
    );

    return this.inventoryService.receivePurchaseOrder(
      params.purchaseOrderId,
      body,
      currentStaff.staffUser.id,
    );
  }

  @Get('branches/:branchId/inventory/receipts')
  @RequiredPermission('inventory.read', { branchIdParam: 'branchId' })
  listInventoryReceipts(@Param() params: BranchIdParamDto) {
    return this.inventoryService.listInventoryReceipts(params.branchId);
  }
}
