import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentStaff } from '../staff-auth/decorators/current-staff.decorator';
import { StaffSessionGuard } from '../staff-auth/guards/staff-session.guard';
import { StaffAuthContext } from '../staff-auth/staff-auth.types';
import { RequiredPermission } from '../staff/required-permission.decorator';
import { StaffPermissionGuard } from '../staff/staff-permission.guard';
import { StaffScopedAccessService } from '../staff/staff-scoped-access.service';
import { UpsertBranchMenuItemOverrideDto } from './dto/branch-menu-item-override.dto';
import {
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
} from './dto/create-update-category.dto';
import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
} from './dto/create-update-menu-item.dto';
import {
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
} from './dto/create-update-modifier-group.dto';
import {
  CreateModifierOptionDto,
  UpdateModifierOptionDto,
} from './dto/create-update-modifier-option.dto';
import {
  ListBranchItemOverridesQueryDto,
  ListMenuCategoriesQueryDto,
  ListMenuItemsQueryDto,
  ListModifierGroupsQueryDto,
} from './dto/list-menu-admin-query.dto';
import {
  BranchIdParamDto,
  BranchItemOverrideParamDto,
  CategoryIdParamDto,
  CompanyIdParamDto,
  GroupIdParamDto,
  ItemIdParamDto,
  ItemModifierGroupLinkParamDto,
  OptionIdParamDto,
} from './dto/menu-admin-param.dto';
import {
  CreateMenuItemModifierGroupDto,
  UpdateMenuItemModifierGroupDto,
} from './dto/menu-item-modifier-group.dto';
import { ReorderPayloadDto } from './dto/reorder-payload.dto';
import { MenuAdminService } from './menu-admin.service';

@Controller()
@UseGuards(StaffSessionGuard, StaffPermissionGuard)
export class MenuAdminController {
  constructor(
    private readonly menuAdminService: MenuAdminService,
    private readonly staffScopedAccessService: StaffScopedAccessService,
  ) {}

  @Get('companies/:companyId/menu-admin/overview')
  @RequiredPermission('menu.read', { companyIdParam: 'companyId' })
  getOverview(@Param() params: CompanyIdParamDto) {
    return this.menuAdminService.getOverview(params.companyId);
  }

  @Get('branches/:branchId/menu-admin/overview')
  @RequiredPermission('menu.read', { branchIdParam: 'branchId' })
  getBranchOverview(@Param() params: BranchIdParamDto) {
    return this.menuAdminService.getBranchOverview(params.branchId);
  }

  @Get('companies/:companyId/menu-admin/categories')
  @RequiredPermission('menu.read', { companyIdParam: 'companyId' })
  listCategories(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListMenuCategoriesQueryDto,
  ) {
    return this.menuAdminService.listCategories(params.companyId, query);
  }

  @Post('companies/:companyId/menu-admin/categories')
  @RequiredPermission('menu.manage_categories', { companyIdParam: 'companyId' })
  createCategory(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateMenuCategoryDto,
  ) {
    return this.menuAdminService.createCategory(params.companyId, body);
  }

  @Post('companies/:companyId/menu-admin/categories/reorder')
  @RequiredPermission('menu.manage_categories', { companyIdParam: 'companyId' })
  reorderCategories(
    @Param() params: CompanyIdParamDto,
    @Body() body: ReorderPayloadDto,
  ) {
    return this.menuAdminService.reorderCategories(params.companyId, body);
  }

  @Get('menu-admin/categories/:categoryId')
  async getCategory(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: CategoryIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuCategory(
      currentStaff.staffUser.id,
      'menu.read',
      params.categoryId,
    );

    return this.menuAdminService.getCategory(params.categoryId);
  }

  @Patch('menu-admin/categories/:categoryId')
  async updateCategory(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: CategoryIdParamDto,
    @Body() body: UpdateMenuCategoryDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuCategory(
      currentStaff.staffUser.id,
      'menu.manage_categories',
      params.categoryId,
    );

    return this.menuAdminService.updateCategory(params.categoryId, body);
  }

  @Post('menu-admin/categories/:categoryId/activate')
  async activateCategory(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: CategoryIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuCategory(
      currentStaff.staffUser.id,
      'menu.manage_categories',
      params.categoryId,
    );

    return this.menuAdminService.activateCategory(params.categoryId);
  }

  @Post('menu-admin/categories/:categoryId/deactivate')
  async deactivateCategory(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: CategoryIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuCategory(
      currentStaff.staffUser.id,
      'menu.manage_categories',
      params.categoryId,
    );

    return this.menuAdminService.deactivateCategory(params.categoryId);
  }

  @Get('companies/:companyId/menu-admin/items')
  @RequiredPermission('menu.read', { companyIdParam: 'companyId' })
  listItems(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListMenuItemsQueryDto,
  ) {
    return this.menuAdminService.listItems(params.companyId, query);
  }

  @Post('companies/:companyId/menu-admin/items')
  @RequiredPermission('menu.manage_items', { companyIdParam: 'companyId' })
  createItem(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateMenuItemDto,
  ) {
    return this.menuAdminService.createItem(params.companyId, body);
  }

  @Post('companies/:companyId/menu-admin/items/reorder')
  @RequiredPermission('menu.manage_items', { companyIdParam: 'companyId' })
  reorderItems(
    @Param() params: CompanyIdParamDto,
    @Body() body: ReorderPayloadDto,
  ) {
    return this.menuAdminService.reorderItems(params.companyId, body);
  }

  @Get('menu-admin/items/:itemId')
  async getItem(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'menu.read',
      params.itemId,
    );

    return this.menuAdminService.getItem(params.itemId);
  }

  @Patch('menu-admin/items/:itemId')
  async updateItem(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemIdParamDto,
    @Body() body: UpdateMenuItemDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'menu.manage_items',
      params.itemId,
    );

    return this.menuAdminService.updateItem(params.itemId, body);
  }

  @Post('menu-admin/items/:itemId/activate')
  async activateItem(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'menu.manage_items',
      params.itemId,
    );

    return this.menuAdminService.activateItem(params.itemId);
  }

  @Post('menu-admin/items/:itemId/deactivate')
  async deactivateItem(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'menu.manage_items',
      params.itemId,
    );

    return this.menuAdminService.deactivateItem(params.itemId);
  }

  @Post('menu-admin/items/:itemId/archive')
  async archiveItem(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'menu.manage_items',
      params.itemId,
    );

    return this.menuAdminService.archiveItem(params.itemId);
  }

  @Get('companies/:companyId/menu-admin/modifier-groups')
  @RequiredPermission('menu.read', { companyIdParam: 'companyId' })
  listModifierGroups(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListModifierGroupsQueryDto,
  ) {
    return this.menuAdminService.listModifierGroups(params.companyId, query);
  }

  @Post('companies/:companyId/menu-admin/modifier-groups')
  @RequiredPermission('menu.manage_modifiers', { companyIdParam: 'companyId' })
  createModifierGroup(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateModifierGroupDto,
  ) {
    return this.menuAdminService.createModifierGroup(params.companyId, body);
  }

  @Get('menu-admin/modifier-groups/:groupId/options')
  async listModifierOptions(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: GroupIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierGroup(
      currentStaff.staffUser.id,
      'menu.read',
      params.groupId,
    );

    return this.menuAdminService.listModifierOptions(params.groupId);
  }

  @Post('menu-admin/modifier-groups/:groupId/options')
  async createModifierOption(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: GroupIdParamDto,
    @Body() body: CreateModifierOptionDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierGroup(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.groupId,
    );

    return this.menuAdminService.createModifierOption(params.groupId, body);
  }

  @Post('menu-admin/modifier-groups/:groupId/options/reorder')
  async reorderModifierOptions(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: GroupIdParamDto,
    @Body() body: ReorderPayloadDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierGroup(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.groupId,
    );

    return this.menuAdminService.reorderModifierOptions(params.groupId, body);
  }

  @Get('menu-admin/modifier-groups/:groupId')
  async getModifierGroup(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: GroupIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierGroup(
      currentStaff.staffUser.id,
      'menu.read',
      params.groupId,
    );

    return this.menuAdminService.getModifierGroup(params.groupId);
  }

  @Patch('menu-admin/modifier-groups/:groupId')
  async updateModifierGroup(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: GroupIdParamDto,
    @Body() body: UpdateModifierGroupDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierGroup(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.groupId,
    );

    return this.menuAdminService.updateModifierGroup(params.groupId, body);
  }

  @Post('menu-admin/modifier-groups/:groupId/activate')
  async activateModifierGroup(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: GroupIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierGroup(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.groupId,
    );

    return this.menuAdminService.activateModifierGroup(params.groupId);
  }

  @Post('menu-admin/modifier-groups/:groupId/deactivate')
  async deactivateModifierGroup(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: GroupIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierGroup(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.groupId,
    );

    return this.menuAdminService.deactivateModifierGroup(params.groupId);
  }

  @Patch('menu-admin/modifier-options/:optionId')
  async updateModifierOption(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OptionIdParamDto,
    @Body() body: UpdateModifierOptionDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierOption(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.optionId,
    );

    return this.menuAdminService.updateModifierOption(params.optionId, body);
  }

  @Post('menu-admin/modifier-options/:optionId/activate')
  async activateModifierOption(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OptionIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierOption(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.optionId,
    );

    return this.menuAdminService.activateModifierOption(params.optionId);
  }

  @Post('menu-admin/modifier-options/:optionId/deactivate')
  async deactivateModifierOption(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: OptionIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForModifierOption(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.optionId,
    );

    return this.menuAdminService.deactivateModifierOption(params.optionId);
  }

  @Get('menu-admin/items/:itemId/modifier-groups')
  async listItemModifierGroups(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemIdParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'menu.read',
      params.itemId,
    );

    return this.menuAdminService.listItemModifierGroups(params.itemId);
  }

  @Post('menu-admin/items/:itemId/modifier-groups')
  async createItemModifierGroup(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemIdParamDto,
    @Body() body: CreateMenuItemModifierGroupDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.itemId,
    );

    return this.menuAdminService.createItemModifierGroup(params.itemId, body);
  }

  @Post('menu-admin/items/:itemId/modifier-groups/reorder')
  async reorderItemModifierGroups(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemIdParamDto,
    @Body() body: ReorderPayloadDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItem(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.itemId,
    );

    return this.menuAdminService.reorderItemModifierGroups(params.itemId, body);
  }

  @Patch('menu-admin/items/:itemId/modifier-groups/:linkId')
  async updateItemModifierGroup(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemModifierGroupLinkParamDto,
    @Body() body: UpdateMenuItemModifierGroupDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItemModifierGroup(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.itemId,
      params.linkId,
    );

    return this.menuAdminService.updateItemModifierGroup(
      params.itemId,
      params.linkId,
      body,
    );
  }

  @Delete('menu-admin/items/:itemId/modifier-groups/:linkId')
  async deleteItemModifierGroup(
    @CurrentStaff() currentStaff: StaffAuthContext,
    @Param() params: ItemModifierGroupLinkParamDto,
  ) {
    await this.staffScopedAccessService.assertCanForMenuItemModifierGroup(
      currentStaff.staffUser.id,
      'menu.manage_modifiers',
      params.itemId,
      params.linkId,
    );

    return this.menuAdminService.deleteItemModifierGroup(
      params.itemId,
      params.linkId,
    );
  }

  @Get('branches/:branchId/menu-admin/item-overrides')
  @RequiredPermission('menu.read', { branchIdParam: 'branchId' })
  listBranchItemOverrides(
    @Param() params: BranchIdParamDto,
    @Query() query: ListBranchItemOverridesQueryDto,
  ) {
    return this.menuAdminService.listBranchItemOverrides(
      params.branchId,
      query,
    );
  }

  @Put('branches/:branchId/menu-admin/items/:itemId/override')
  @RequiredPermission('menu.manage_branch_overrides', {
    branchIdParam: 'branchId',
  })
  upsertBranchItemOverride(
    @Param() params: BranchItemOverrideParamDto,
    @Body() body: UpsertBranchMenuItemOverrideDto,
  ) {
    return this.menuAdminService.upsertBranchItemOverride(
      params.branchId,
      params.itemId,
      body,
    );
  }

  @Delete('branches/:branchId/menu-admin/items/:itemId/override')
  @RequiredPermission('menu.manage_branch_overrides', {
    branchIdParam: 'branchId',
  })
  deleteBranchItemOverride(@Param() params: BranchItemOverrideParamDto) {
    return this.menuAdminService.deleteBranchItemOverride(
      params.branchId,
      params.itemId,
    );
  }
}
