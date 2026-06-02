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
} from '@nestjs/common';
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
export class MenuAdminController {
  constructor(private readonly menuAdminService: MenuAdminService) {}

  @Get('companies/:companyId/menu-admin/overview')
  getOverview(@Param() params: CompanyIdParamDto) {
    return this.menuAdminService.getOverview(params.companyId);
  }

  @Get('companies/:companyId/menu-admin/categories')
  listCategories(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListMenuCategoriesQueryDto,
  ) {
    return this.menuAdminService.listCategories(params.companyId, query);
  }

  @Post('companies/:companyId/menu-admin/categories')
  createCategory(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateMenuCategoryDto,
  ) {
    return this.menuAdminService.createCategory(params.companyId, body);
  }

  @Post('companies/:companyId/menu-admin/categories/reorder')
  reorderCategories(
    @Param() params: CompanyIdParamDto,
    @Body() body: ReorderPayloadDto,
  ) {
    return this.menuAdminService.reorderCategories(params.companyId, body);
  }

  @Get('menu-admin/categories/:categoryId')
  getCategory(@Param() params: CategoryIdParamDto) {
    return this.menuAdminService.getCategory(params.categoryId);
  }

  @Patch('menu-admin/categories/:categoryId')
  updateCategory(
    @Param() params: CategoryIdParamDto,
    @Body() body: UpdateMenuCategoryDto,
  ) {
    return this.menuAdminService.updateCategory(params.categoryId, body);
  }

  @Post('menu-admin/categories/:categoryId/activate')
  activateCategory(@Param() params: CategoryIdParamDto) {
    return this.menuAdminService.activateCategory(params.categoryId);
  }

  @Post('menu-admin/categories/:categoryId/deactivate')
  deactivateCategory(@Param() params: CategoryIdParamDto) {
    return this.menuAdminService.deactivateCategory(params.categoryId);
  }

  @Get('companies/:companyId/menu-admin/items')
  listItems(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListMenuItemsQueryDto,
  ) {
    return this.menuAdminService.listItems(params.companyId, query);
  }

  @Post('companies/:companyId/menu-admin/items')
  createItem(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateMenuItemDto,
  ) {
    return this.menuAdminService.createItem(params.companyId, body);
  }

  @Post('companies/:companyId/menu-admin/items/reorder')
  reorderItems(
    @Param() params: CompanyIdParamDto,
    @Body() body: ReorderPayloadDto,
  ) {
    return this.menuAdminService.reorderItems(params.companyId, body);
  }

  @Get('menu-admin/items/:itemId')
  getItem(@Param() params: ItemIdParamDto) {
    return this.menuAdminService.getItem(params.itemId);
  }

  @Patch('menu-admin/items/:itemId')
  updateItem(@Param() params: ItemIdParamDto, @Body() body: UpdateMenuItemDto) {
    return this.menuAdminService.updateItem(params.itemId, body);
  }

  @Post('menu-admin/items/:itemId/activate')
  activateItem(@Param() params: ItemIdParamDto) {
    return this.menuAdminService.activateItem(params.itemId);
  }

  @Post('menu-admin/items/:itemId/deactivate')
  deactivateItem(@Param() params: ItemIdParamDto) {
    return this.menuAdminService.deactivateItem(params.itemId);
  }

  @Post('menu-admin/items/:itemId/archive')
  archiveItem(@Param() params: ItemIdParamDto) {
    return this.menuAdminService.archiveItem(params.itemId);
  }

  @Get('companies/:companyId/menu-admin/modifier-groups')
  listModifierGroups(
    @Param() params: CompanyIdParamDto,
    @Query() query: ListModifierGroupsQueryDto,
  ) {
    return this.menuAdminService.listModifierGroups(params.companyId, query);
  }

  @Post('companies/:companyId/menu-admin/modifier-groups')
  createModifierGroup(
    @Param() params: CompanyIdParamDto,
    @Body() body: CreateModifierGroupDto,
  ) {
    return this.menuAdminService.createModifierGroup(params.companyId, body);
  }

  @Get('menu-admin/modifier-groups/:groupId/options')
  listModifierOptions(@Param() params: GroupIdParamDto) {
    return this.menuAdminService.listModifierOptions(params.groupId);
  }

  @Post('menu-admin/modifier-groups/:groupId/options')
  createModifierOption(
    @Param() params: GroupIdParamDto,
    @Body() body: CreateModifierOptionDto,
  ) {
    return this.menuAdminService.createModifierOption(params.groupId, body);
  }

  @Post('menu-admin/modifier-groups/:groupId/options/reorder')
  reorderModifierOptions(
    @Param() params: GroupIdParamDto,
    @Body() body: ReorderPayloadDto,
  ) {
    return this.menuAdminService.reorderModifierOptions(params.groupId, body);
  }

  @Get('menu-admin/modifier-groups/:groupId')
  getModifierGroup(@Param() params: GroupIdParamDto) {
    return this.menuAdminService.getModifierGroup(params.groupId);
  }

  @Patch('menu-admin/modifier-groups/:groupId')
  updateModifierGroup(
    @Param() params: GroupIdParamDto,
    @Body() body: UpdateModifierGroupDto,
  ) {
    return this.menuAdminService.updateModifierGroup(params.groupId, body);
  }

  @Post('menu-admin/modifier-groups/:groupId/activate')
  activateModifierGroup(@Param() params: GroupIdParamDto) {
    return this.menuAdminService.activateModifierGroup(params.groupId);
  }

  @Post('menu-admin/modifier-groups/:groupId/deactivate')
  deactivateModifierGroup(@Param() params: GroupIdParamDto) {
    return this.menuAdminService.deactivateModifierGroup(params.groupId);
  }

  @Patch('menu-admin/modifier-options/:optionId')
  updateModifierOption(
    @Param() params: OptionIdParamDto,
    @Body() body: UpdateModifierOptionDto,
  ) {
    return this.menuAdminService.updateModifierOption(params.optionId, body);
  }

  @Post('menu-admin/modifier-options/:optionId/activate')
  activateModifierOption(@Param() params: OptionIdParamDto) {
    return this.menuAdminService.activateModifierOption(params.optionId);
  }

  @Post('menu-admin/modifier-options/:optionId/deactivate')
  deactivateModifierOption(@Param() params: OptionIdParamDto) {
    return this.menuAdminService.deactivateModifierOption(params.optionId);
  }

  @Get('menu-admin/items/:itemId/modifier-groups')
  listItemModifierGroups(@Param() params: ItemIdParamDto) {
    return this.menuAdminService.listItemModifierGroups(params.itemId);
  }

  @Post('menu-admin/items/:itemId/modifier-groups')
  createItemModifierGroup(
    @Param() params: ItemIdParamDto,
    @Body() body: CreateMenuItemModifierGroupDto,
  ) {
    return this.menuAdminService.createItemModifierGroup(params.itemId, body);
  }

  @Post('menu-admin/items/:itemId/modifier-groups/reorder')
  reorderItemModifierGroups(
    @Param() params: ItemIdParamDto,
    @Body() body: ReorderPayloadDto,
  ) {
    return this.menuAdminService.reorderItemModifierGroups(params.itemId, body);
  }

  @Patch('menu-admin/items/:itemId/modifier-groups/:linkId')
  updateItemModifierGroup(
    @Param() params: ItemModifierGroupLinkParamDto,
    @Body() body: UpdateMenuItemModifierGroupDto,
  ) {
    return this.menuAdminService.updateItemModifierGroup(
      params.itemId,
      params.linkId,
      body,
    );
  }

  @Delete('menu-admin/items/:itemId/modifier-groups/:linkId')
  deleteItemModifierGroup(@Param() params: ItemModifierGroupLinkParamDto) {
    return this.menuAdminService.deleteItemModifierGroup(
      params.itemId,
      params.linkId,
    );
  }

  @Get('branches/:branchId/menu-admin/item-overrides')
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
  deleteBranchItemOverride(@Param() params: BranchItemOverrideParamDto) {
    return this.menuAdminService.deleteBranchItemOverride(
      params.branchId,
      params.itemId,
    );
  }
}
