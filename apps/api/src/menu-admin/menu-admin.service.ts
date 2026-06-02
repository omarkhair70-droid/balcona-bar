import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MenuCategoryStatus,
  MenuItemStatus,
  ModifierGroupStatus,
  ModifierOptionStatus,
  ModifierSelectionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  MENU_ITEM_STATUSES,
  MODIFIER_GROUP_STATUSES,
} from './dto/menu-admin-values';
import {
  CreateMenuItemModifierGroupDto,
  UpdateMenuItemModifierGroupDto,
} from './dto/menu-item-modifier-group.dto';
import { ReorderPayloadDto } from './dto/reorder-payload.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const companySummarySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySelect;

type CompanySummary = Prisma.CompanyGetPayload<{
  select: typeof companySummarySelect;
}>;

const branchSummarySelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  address: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSelect;

type BranchSummary = Prisma.BranchGetPayload<{
  select: typeof branchSummarySelect;
}>;

const categorySelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  description: true,
  sortOrder: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MenuCategorySelect;

const modifierOptionSelect = {
  id: true,
  groupId: true,
  name: true,
  slug: true,
  priceDeltaMinor: true,
  status: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModifierOptionSelect;

const modifierGroupSummarySelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  description: true,
  selectionType: true,
  isRequired: true,
  minSelections: true,
  maxSelections: true,
  sortOrder: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModifierGroupSelect;

const modifierGroupDetailSelect = {
  ...modifierGroupSummarySelect,
  options: {
    orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
    select: modifierOptionSelect,
  },
} satisfies Prisma.ModifierGroupSelect;

const menuItemSummarySelect = {
  id: true,
  companyId: true,
  categoryId: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  basePriceMinor: true,
  currency: true,
  station: true,
  status: true,
  isFeatured: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: categorySelect,
  },
} satisfies Prisma.MenuItemSelect;

const menuItemModifierGroupSelect = {
  id: true,
  menuItemId: true,
  modifierGroupId: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  modifierGroup: {
    select: modifierGroupDetailSelect,
  },
} satisfies Prisma.MenuItemModifierGroupSelect;

const menuItemDetailSelect = {
  ...menuItemSummarySelect,
  modifierGroups: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    select: menuItemModifierGroupSelect,
  },
  branchOverrides: {
    orderBy: [{ createdAt: 'asc' as const }],
    select: {
      id: true,
      branchId: true,
      menuItemId: true,
      priceOverrideMinor: true,
      isAvailable: true,
      isVisible: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: branchSummarySelect,
      },
    },
  },
} satisfies Prisma.MenuItemSelect;

const branchOverrideSelect = {
  id: true,
  branchId: true,
  menuItemId: true,
  priceOverrideMinor: true,
  isAvailable: true,
  isVisible: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  branch: {
    select: branchSummarySelect,
  },
  menuItem: {
    select: menuItemSummarySelect,
  },
} satisfies Prisma.BranchMenuItemOverrideSelect;

type MenuItemSummary = Prisma.MenuItemGetPayload<{
  select: typeof menuItemSummarySelect;
}>;

type MenuItemModifierGroupRecord = Prisma.MenuItemModifierGroupGetPayload<{
  select: typeof menuItemModifierGroupSelect;
}>;

type BranchOverrideRecord = Prisma.BranchMenuItemOverrideGetPayload<{
  select: typeof branchOverrideSelect;
}>;

type ModifierGroupSelectionState = {
  selectionType: ModifierSelectionType;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
};

@Injectable()
export class MenuAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(companyId: string) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const [
      categories,
      itemCountsByStatus,
      modifierGroupCountsByStatus,
      branchOverrideCount,
    ] = await Promise.all([
      this.prisma.menuCategory.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          ...categorySelect,
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      this.prisma.menuItem.groupBy({
        by: ['status'],
        where: { companyId },
        _count: {
          _all: true,
        },
      }),
      this.prisma.modifierGroup.groupBy({
        by: ['status'],
        where: { companyId },
        _count: {
          _all: true,
        },
      }),
      this.prisma.branchMenuItemOverride.count({
        where: {
          menuItem: {
            companyId,
          },
        },
      }),
    ]);

    const modifierGroupCounts = this.toStatusCounts(
      modifierGroupCountsByStatus,
      MODIFIER_GROUP_STATUSES,
    );

    return {
      company,
      categories: categories.map((category) => ({
        id: category.id,
        companyId: category.companyId,
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        status: category.status,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        itemCount: category._count.items,
      })),
      itemCountsByStatus: this.toStatusCounts(
        itemCountsByStatus,
        MENU_ITEM_STATUSES,
      ),
      modifierGroupCounts: {
        ...modifierGroupCounts,
        total: Object.values(modifierGroupCounts).reduce(
          (total, count) => total + count,
          0,
        ),
      },
      branchOverrideCounts: {
        total: branchOverrideCount,
      },
    };
  }

  async listCategories(companyId: string, query: ListMenuCategoriesQueryDto) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const where: Prisma.MenuCategoryWhereInput = { companyId };
    const search = this.normalizeSearch(query.search);

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const categories = await this.prisma.menuCategory.findMany({
      where,
      take: this.limit(query.limit),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        ...categorySelect,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return {
      company,
      categories: categories.map((category) => ({
        id: category.id,
        companyId: category.companyId,
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        status: category.status,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        itemCount: category._count.items,
      })),
    };
  }

  async createCategory(companyId: string, body: CreateMenuCategoryDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const company = await this.findCompanyOrThrow(companyId, tx);
        const category = await tx.menuCategory.create({
          data: {
            companyId: company.id,
            name: body.name.trim(),
            slug: body.slug.trim(),
            description: this.normalizeOptionalText(body.description),
            sortOrder: body.sortOrder ?? 0,
            status: body.status ?? MenuCategoryStatus.active,
          },
          select: categorySelect,
        });

        return { company, category };
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Category slug must be unique per company',
      );
    }
  }

  async getCategory(categoryId: string) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: {
        ...categorySelect,
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Menu category not found');
    }

    return {
      category: {
        id: category.id,
        companyId: category.companyId,
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        status: category.status,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        itemCount: category._count.items,
      },
    };
  }

  async updateCategory(categoryId: string, body: UpdateMenuCategoryDto) {
    const existingCategory = await this.findCategoryOrThrow(
      categoryId,
      this.prisma,
    );
    const data: Prisma.MenuCategoryUpdateInput = {};

    if (body.name !== undefined) {
      data.name = body.name.trim();
    }

    if (body.slug !== undefined) {
      data.slug = body.slug.trim();
    }

    if (this.hasOwn(body, 'description')) {
      data.description = this.normalizeOptionalText(body.description);
    }

    if (body.sortOrder !== undefined) {
      data.sortOrder = body.sortOrder;
    }

    if (body.status !== undefined) {
      data.status = body.status;
    }

    try {
      const category = await this.prisma.menuCategory.update({
        where: { id: existingCategory.id },
        data,
        select: categorySelect,
      });

      return { category };
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Category slug must be unique per company',
      );
    }
  }

  activateCategory(categoryId: string) {
    return this.updateCategoryStatus(categoryId, MenuCategoryStatus.active);
  }

  deactivateCategory(categoryId: string) {
    return this.updateCategoryStatus(categoryId, MenuCategoryStatus.inactive);
  }

  async listItems(companyId: string, query: ListMenuItemsQueryDto) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const where: Prisma.MenuItemWhereInput = { companyId };
    const search = this.normalizeSearch(query.search);

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.station) {
      where.station = query.station;
    }

    const featured = this.parseBooleanQuery(query.featured);

    if (featured !== undefined) {
      where.isFeatured = featured;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.menuItem.findMany({
      where,
      take: this.limit(query.limit),
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      select: menuItemSummarySelect,
    });

    return { company, items };
  }

  async createItem(companyId: string, body: CreateMenuItemDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const company = await this.findCompanyOrThrow(companyId, tx);
        const category = await this.findCategoryOrThrow(body.categoryId, tx);
        this.assertSameCompany(category.companyId, company.id, 'Category');

        const item = await tx.menuItem.create({
          data: {
            companyId: company.id,
            categoryId: category.id,
            name: body.name.trim(),
            slug: body.slug.trim(),
            description: this.normalizeOptionalText(body.description),
            imageUrl: this.normalizeOptionalText(body.imageUrl),
            basePriceMinor: body.basePriceMinor,
            currency: this.normalizeCurrency(body.currency),
            station: body.station,
            status: body.status ?? MenuItemStatus.active,
            isFeatured: body.isFeatured ?? false,
            sortOrder: body.sortOrder ?? 0,
          },
          select: menuItemDetailSelect,
        });

        return { company, category, item: this.toMenuItemDetail(item) };
      });
    } catch (error) {
      this.handleKnownWriteError(error, 'Item slug must be unique per company');
    }
  }

  async getItem(itemId: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      select: menuItemDetailSelect,
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return { item: this.toMenuItemDetail(item) };
  }

  async updateItem(itemId: string, body: UpdateMenuItemDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingItem = await this.findItemOrThrow(itemId, tx);
        const data: Prisma.MenuItemUpdateInput = {};

        if (body.categoryId !== undefined) {
          const category = await this.findCategoryOrThrow(body.categoryId, tx);
          this.assertSameCompany(
            category.companyId,
            existingItem.companyId,
            'Category',
          );
          data.category = { connect: { id: category.id } };
        }

        if (body.name !== undefined) {
          data.name = body.name.trim();
        }

        if (body.slug !== undefined) {
          data.slug = body.slug.trim();
        }

        if (this.hasOwn(body, 'description')) {
          data.description = this.normalizeOptionalText(body.description);
        }

        if (this.hasOwn(body, 'imageUrl')) {
          data.imageUrl = this.normalizeOptionalText(body.imageUrl);
        }

        if (body.basePriceMinor !== undefined) {
          data.basePriceMinor = body.basePriceMinor;
        }

        if (body.currency !== undefined) {
          data.currency = this.normalizeCurrency(body.currency);
        }

        if (body.station !== undefined) {
          data.station = body.station;
        }

        if (body.status !== undefined) {
          data.status = body.status;
        }

        if (body.isFeatured !== undefined) {
          data.isFeatured = body.isFeatured;
        }

        if (body.sortOrder !== undefined) {
          data.sortOrder = body.sortOrder;
        }

        const item = await tx.menuItem.update({
          where: { id: existingItem.id },
          data,
          select: menuItemDetailSelect,
        });

        return { item: this.toMenuItemDetail(item) };
      });
    } catch (error) {
      this.handleKnownWriteError(error, 'Item slug must be unique per company');
    }
  }

  activateItem(itemId: string) {
    return this.updateItemStatus(itemId, MenuItemStatus.active);
  }

  deactivateItem(itemId: string) {
    return this.updateItemStatus(itemId, MenuItemStatus.inactive);
  }

  archiveItem(itemId: string) {
    return this.updateItemStatus(itemId, MenuItemStatus.archived);
  }

  async listModifierGroups(
    companyId: string,
    query: ListModifierGroupsQueryDto,
  ) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const where: Prisma.ModifierGroupWhereInput = { companyId };
    const search = this.normalizeSearch(query.search);

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const modifierGroups = await this.prisma.modifierGroup.findMany({
      where,
      take: this.limit(query.limit),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        ...modifierGroupSummarySelect,
        _count: {
          select: {
            options: true,
            menuItems: true,
          },
        },
      },
    });

    return { company, modifierGroups };
  }

  async createModifierGroup(companyId: string, body: CreateModifierGroupDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const company = await this.findCompanyOrThrow(companyId, tx);
        const selectionState = this.toCreateSelectionState(body);
        this.assertValidSelectionState(selectionState);
        const modifierGroup = await tx.modifierGroup.create({
          data: {
            companyId: company.id,
            name: body.name.trim(),
            slug: body.slug.trim(),
            description: this.normalizeOptionalText(body.description),
            selectionType: selectionState.selectionType,
            isRequired: selectionState.isRequired,
            minSelections: selectionState.minSelections,
            maxSelections: selectionState.maxSelections,
            sortOrder: body.sortOrder ?? 0,
            status: body.status ?? ModifierGroupStatus.active,
          },
          select: modifierGroupDetailSelect,
        });

        return { company, modifierGroup };
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Modifier group slug must be unique per company',
      );
    }
  }

  async getModifierGroup(groupId: string) {
    const modifierGroup = await this.prisma.modifierGroup.findUnique({
      where: { id: groupId },
      select: modifierGroupDetailSelect,
    });

    if (!modifierGroup) {
      throw new NotFoundException('Modifier group not found');
    }

    return { modifierGroup };
  }

  async updateModifierGroup(groupId: string, body: UpdateModifierGroupDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingGroup = await tx.modifierGroup.findUnique({
          where: { id: groupId },
          select: modifierGroupSummarySelect,
        });

        if (!existingGroup) {
          throw new NotFoundException('Modifier group not found');
        }

        const selectionState = this.toUpdateSelectionState(existingGroup, body);
        this.assertValidSelectionState(selectionState);
        const data: Prisma.ModifierGroupUpdateInput = {
          selectionType: selectionState.selectionType,
          isRequired: selectionState.isRequired,
          minSelections: selectionState.minSelections,
          maxSelections: selectionState.maxSelections,
        };

        if (body.name !== undefined) {
          data.name = body.name.trim();
        }

        if (body.slug !== undefined) {
          data.slug = body.slug.trim();
        }

        if (this.hasOwn(body, 'description')) {
          data.description = this.normalizeOptionalText(body.description);
        }

        if (body.sortOrder !== undefined) {
          data.sortOrder = body.sortOrder;
        }

        if (body.status !== undefined) {
          data.status = body.status;
        }

        const modifierGroup = await tx.modifierGroup.update({
          where: { id: existingGroup.id },
          data,
          select: modifierGroupDetailSelect,
        });

        return { modifierGroup };
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Modifier group slug must be unique per company',
      );
    }
  }

  activateModifierGroup(groupId: string) {
    return this.updateModifierGroupStatus(groupId, ModifierGroupStatus.active);
  }

  deactivateModifierGroup(groupId: string) {
    return this.updateModifierGroupStatus(
      groupId,
      ModifierGroupStatus.inactive,
    );
  }

  async listModifierOptions(groupId: string) {
    const modifierGroup = await this.findModifierGroupOrThrow(
      groupId,
      this.prisma,
    );
    const options = await this.prisma.modifierOption.findMany({
      where: { groupId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: modifierOptionSelect,
    });

    return { modifierGroup, options };
  }

  async createModifierOption(groupId: string, body: CreateModifierOptionDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const modifierGroup = await this.findModifierGroupOrThrow(groupId, tx);
        const option = await tx.modifierOption.create({
          data: {
            groupId: modifierGroup.id,
            name: body.name.trim(),
            slug: body.slug.trim(),
            priceDeltaMinor: body.priceDeltaMinor ?? 0,
            status: body.status ?? ModifierOptionStatus.active,
            sortOrder: body.sortOrder ?? 0,
          },
          select: modifierOptionSelect,
        });

        return { modifierGroup, option };
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Modifier option slug must be unique per group',
      );
    }
  }

  async updateModifierOption(optionId: string, body: UpdateModifierOptionDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingOption = await tx.modifierOption.findUnique({
          where: { id: optionId },
          select: {
            id: true,
            groupId: true,
          },
        });

        if (!existingOption) {
          throw new NotFoundException('Modifier option not found');
        }

        const data: Prisma.ModifierOptionUpdateInput = {};

        if (body.name !== undefined) {
          data.name = body.name.trim();
        }

        if (body.slug !== undefined) {
          data.slug = body.slug.trim();
        }

        if (body.priceDeltaMinor !== undefined) {
          data.priceDeltaMinor = body.priceDeltaMinor;
        }

        if (body.status !== undefined) {
          data.status = body.status;
        }

        if (body.sortOrder !== undefined) {
          data.sortOrder = body.sortOrder;
        }

        const option = await tx.modifierOption.update({
          where: { id: existingOption.id },
          data,
          select: modifierOptionSelect,
        });

        return { option };
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Modifier option slug must be unique per group',
      );
    }
  }

  activateModifierOption(optionId: string) {
    return this.updateModifierOptionStatus(
      optionId,
      ModifierOptionStatus.active,
    );
  }

  deactivateModifierOption(optionId: string) {
    return this.updateModifierOptionStatus(
      optionId,
      ModifierOptionStatus.inactive,
    );
  }

  async listItemModifierGroups(itemId: string) {
    const item = await this.findItemOrThrow(itemId, this.prisma);
    const modifierGroups = await this.prisma.menuItemModifierGroup.findMany({
      where: { menuItemId: itemId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: menuItemModifierGroupSelect,
    });

    return { item, modifierGroups };
  }

  async createItemModifierGroup(
    itemId: string,
    body: CreateMenuItemModifierGroupDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await this.findItemOrThrow(itemId, tx);
        const modifierGroup = await this.findModifierGroupOrThrow(
          body.modifierGroupId,
          tx,
        );
        this.assertSameCompany(
          modifierGroup.companyId,
          item.companyId,
          'Modifier group',
        );
        const link = await tx.menuItemModifierGroup.create({
          data: {
            menuItemId: item.id,
            modifierGroupId: modifierGroup.id,
            sortOrder: body.sortOrder ?? 0,
          },
          select: menuItemModifierGroupSelect,
        });

        return { item, link };
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Modifier group is already attached to this item',
      );
    }
  }

  async updateItemModifierGroup(
    itemId: string,
    linkId: string,
    body: UpdateMenuItemModifierGroupDto,
  ) {
    const link = await this.findItemModifierGroupLinkOrThrow(
      itemId,
      linkId,
      this.prisma,
    );
    const updatedLink = await this.prisma.menuItemModifierGroup.update({
      where: { id: link.id },
      data: {
        sortOrder: body.sortOrder ?? link.sortOrder,
      },
      select: menuItemModifierGroupSelect,
    });

    return { link: updatedLink };
  }

  async deleteItemModifierGroup(itemId: string, linkId: string) {
    const link = await this.findItemModifierGroupLinkOrThrow(
      itemId,
      linkId,
      this.prisma,
    );
    const deletedLink = await this.prisma.menuItemModifierGroup.delete({
      where: { id: link.id },
      select: menuItemModifierGroupSelect,
    });

    return {
      deleted: true,
      link: deletedLink,
    };
  }

  async listBranchItemOverrides(
    branchId: string,
    query: ListBranchItemOverridesQueryDto,
  ) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const where: Prisma.BranchMenuItemOverrideWhereInput = {
      branchId,
      menuItem: {
        companyId: branch.companyId,
      },
    };

    if (query.itemId) {
      where.menuItemId = query.itemId;
    }

    const available = this.parseBooleanQuery(query.available);

    if (available !== undefined) {
      where.isAvailable = available;
    }

    const visible = this.parseBooleanQuery(query.visible);

    if (visible !== undefined) {
      where.isVisible = visible;
    }

    const overrides = await this.prisma.branchMenuItemOverride.findMany({
      where,
      take: this.limit(query.limit),
      orderBy: [
        { sortOrder: 'asc' },
        { menuItem: { category: { sortOrder: 'asc' } } },
        { menuItem: { sortOrder: 'asc' } },
        { menuItem: { name: 'asc' } },
      ],
      select: branchOverrideSelect,
    });

    return {
      branch,
      overrides: overrides.map((override) => this.toBranchOverride(override)),
    };
  }

  async upsertBranchItemOverride(
    branchId: string,
    itemId: string,
    body: UpsertBranchMenuItemOverrideDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchOrThrow(branchId, tx);
      const item = await this.findItemOrThrow(itemId, tx);
      this.assertSameCompany(item.companyId, branch.companyId, 'Menu item');
      const createData = this.toBranchOverrideCreateData(
        branch.id,
        item.id,
        body,
      );
      const updateData = this.toBranchOverrideUpdateData(body);
      const override = await tx.branchMenuItemOverride.upsert({
        where: {
          branchId_menuItemId: {
            branchId: branch.id,
            menuItemId: item.id,
          },
        },
        create: createData,
        update: updateData,
        select: branchOverrideSelect,
      });

      return {
        branch,
        item,
        override: this.toBranchOverride(override),
      };
    });
  }

  async deleteBranchItemOverride(branchId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchOrThrow(branchId, tx);
      const item = await this.findItemOrThrow(itemId, tx);
      this.assertSameCompany(item.companyId, branch.companyId, 'Menu item');
      const existingOverride = await tx.branchMenuItemOverride.findUnique({
        where: {
          branchId_menuItemId: {
            branchId: branch.id,
            menuItemId: item.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (!existingOverride) {
        throw new NotFoundException('Branch menu item override not found');
      }

      const override = await tx.branchMenuItemOverride.delete({
        where: { id: existingOverride.id },
        select: branchOverrideSelect,
      });

      return {
        deleted: true,
        branch,
        item,
        override: this.toBranchOverride(override),
      };
    });
  }

  reorderCategories(companyId: string, body: ReorderPayloadDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await this.findCompanyOrThrow(companyId, tx);
      this.assertUniqueReorderIds(body);
      await this.assertReorderScope(
        tx.menuCategory.findMany({
          where: {
            companyId,
            id: {
              in: body.items.map((item) => item.id),
            },
          },
          select: { id: true },
        }),
        body,
        'All categories must belong to the company',
      );
      await Promise.all(
        body.items.map((item) =>
          tx.menuCategory.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
            select: { id: true },
          }),
        ),
      );
      const categories = await tx.menuCategory.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: categorySelect,
      });

      return { company, categories };
    });
  }

  reorderItems(companyId: string, body: ReorderPayloadDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await this.findCompanyOrThrow(companyId, tx);
      this.assertUniqueReorderIds(body);
      await this.assertReorderScope(
        tx.menuItem.findMany({
          where: {
            companyId,
            id: {
              in: body.items.map((item) => item.id),
            },
          },
          select: { id: true },
        }),
        body,
        'All items must belong to the company',
      );
      await Promise.all(
        body.items.map((item) =>
          tx.menuItem.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
            select: { id: true },
          }),
        ),
      );
      const items = await tx.menuItem.findMany({
        where: { companyId },
        orderBy: [
          { category: { sortOrder: 'asc' } },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        select: menuItemSummarySelect,
      });

      return { company, items };
    });
  }

  reorderModifierOptions(groupId: string, body: ReorderPayloadDto) {
    return this.prisma.$transaction(async (tx) => {
      const modifierGroup = await this.findModifierGroupOrThrow(groupId, tx);
      this.assertUniqueReorderIds(body);
      await this.assertReorderScope(
        tx.modifierOption.findMany({
          where: {
            groupId,
            id: {
              in: body.items.map((item) => item.id),
            },
          },
          select: { id: true },
        }),
        body,
        'All options must belong to the modifier group',
      );
      await Promise.all(
        body.items.map((item) =>
          tx.modifierOption.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
            select: { id: true },
          }),
        ),
      );
      const options = await tx.modifierOption.findMany({
        where: { groupId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: modifierOptionSelect,
      });

      return { modifierGroup, options };
    });
  }

  reorderItemModifierGroups(itemId: string, body: ReorderPayloadDto) {
    return this.prisma.$transaction(async (tx) => {
      const item = await this.findItemOrThrow(itemId, tx);
      this.assertUniqueReorderIds(body);
      await this.assertReorderScope(
        tx.menuItemModifierGroup.findMany({
          where: {
            menuItemId: item.id,
            id: {
              in: body.items.map((entry) => entry.id),
            },
          },
          select: { id: true },
        }),
        body,
        'All links must belong to the item',
      );
      await Promise.all(
        body.items.map((entry) =>
          tx.menuItemModifierGroup.update({
            where: { id: entry.id },
            data: { sortOrder: entry.sortOrder },
            select: { id: true },
          }),
        ),
      );
      const modifierGroups = await tx.menuItemModifierGroup.findMany({
        where: { menuItemId: item.id },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: menuItemModifierGroupSelect,
      });

      return { item, modifierGroups };
    });
  }

  private async updateCategoryStatus(
    categoryId: string,
    status: MenuCategoryStatus,
  ) {
    await this.findCategoryOrThrow(categoryId, this.prisma);
    const category = await this.prisma.menuCategory.update({
      where: { id: categoryId },
      data: { status },
      select: categorySelect,
    });

    return { category };
  }

  private async updateItemStatus(itemId: string, status: MenuItemStatus) {
    await this.findItemOrThrow(itemId, this.prisma);
    const item = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: { status },
      select: menuItemDetailSelect,
    });

    return { item: this.toMenuItemDetail(item) };
  }

  private async updateModifierGroupStatus(
    groupId: string,
    status: ModifierGroupStatus,
  ) {
    await this.findModifierGroupOrThrow(groupId, this.prisma);
    const modifierGroup = await this.prisma.modifierGroup.update({
      where: { id: groupId },
      data: { status },
      select: modifierGroupDetailSelect,
    });

    return { modifierGroup };
  }

  private async updateModifierOptionStatus(
    optionId: string,
    status: ModifierOptionStatus,
  ) {
    const existingOption = await this.prisma.modifierOption.findUnique({
      where: { id: optionId },
      select: {
        id: true,
      },
    });

    if (!existingOption) {
      throw new NotFoundException('Modifier option not found');
    }

    const option = await this.prisma.modifierOption.update({
      where: { id: existingOption.id },
      data: { status },
      select: modifierOptionSelect,
    });

    return { option };
  }

  private async findCompanyOrThrow(
    companyId: string,
    tx: PrismaExecutor,
  ): Promise<CompanySummary> {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: companySummarySelect,
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  private async findBranchOrThrow(
    branchId: string,
    tx: PrismaExecutor,
  ): Promise<BranchSummary> {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: branchSummarySelect,
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async findCategoryOrThrow(categoryId: string, tx: PrismaExecutor) {
    const category = await tx.menuCategory.findUnique({
      where: { id: categoryId },
      select: categorySelect,
    });

    if (!category) {
      throw new NotFoundException('Menu category not found');
    }

    return category;
  }

  private async findItemOrThrow(
    itemId: string,
    tx: PrismaExecutor,
  ): Promise<MenuItemSummary> {
    const item = await tx.menuItem.findUnique({
      where: { id: itemId },
      select: menuItemSummarySelect,
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return item;
  }

  private async findModifierGroupOrThrow(groupId: string, tx: PrismaExecutor) {
    const modifierGroup = await tx.modifierGroup.findUnique({
      where: { id: groupId },
      select: modifierGroupDetailSelect,
    });

    if (!modifierGroup) {
      throw new NotFoundException('Modifier group not found');
    }

    return modifierGroup;
  }

  private async findItemModifierGroupLinkOrThrow(
    itemId: string,
    linkId: string,
    tx: PrismaExecutor,
  ): Promise<MenuItemModifierGroupRecord> {
    const link = await tx.menuItemModifierGroup.findUnique({
      where: { id: linkId },
      select: menuItemModifierGroupSelect,
    });

    if (!link) {
      throw new NotFoundException('Item modifier group link not found');
    }

    if (link.menuItemId !== itemId) {
      throw new BadRequestException('Link does not belong to the item');
    }

    return link;
  }

  private toCreateSelectionState(
    body: CreateModifierGroupDto,
  ): ModifierGroupSelectionState {
    const isRequired = body.isRequired ?? false;

    return {
      selectionType: body.selectionType,
      isRequired,
      minSelections: body.minSelections ?? (isRequired ? 1 : 0),
      maxSelections: body.maxSelections ?? 1,
    };
  }

  private toUpdateSelectionState(
    existingGroup: ModifierGroupSelectionState,
    body: UpdateModifierGroupDto,
  ): ModifierGroupSelectionState {
    return {
      selectionType: body.selectionType ?? existingGroup.selectionType,
      isRequired: body.isRequired ?? existingGroup.isRequired,
      minSelections: body.minSelections ?? existingGroup.minSelections,
      maxSelections: body.maxSelections ?? existingGroup.maxSelections,
    };
  }

  private assertValidSelectionState(state: ModifierGroupSelectionState) {
    if (state.maxSelections < state.minSelections) {
      throw new BadRequestException(
        'maxSelections must be greater than or equal to minSelections',
      );
    }

    if (
      state.selectionType === ModifierSelectionType.single &&
      state.maxSelections !== 1
    ) {
      throw new BadRequestException(
        'Single selection modifier groups must have maxSelections = 1',
      );
    }

    if (state.isRequired && state.minSelections < 1) {
      throw new BadRequestException(
        'Required modifier groups must have minSelections >= 1',
      );
    }
  }

  private toBranchOverrideCreateData(
    branchId: string,
    menuItemId: string,
    body: UpsertBranchMenuItemOverrideDto,
  ): Prisma.BranchMenuItemOverrideUncheckedCreateInput {
    return {
      branchId,
      menuItemId,
      priceOverrideMinor: this.hasOwn(body, 'priceOverrideMinor')
        ? (body.priceOverrideMinor ?? null)
        : null,
      isAvailable: body.isAvailable ?? true,
      isVisible: body.isVisible ?? true,
      sortOrder: this.hasOwn(body, 'sortOrder')
        ? (body.sortOrder ?? null)
        : null,
    };
  }

  private toBranchOverrideUpdateData(
    body: UpsertBranchMenuItemOverrideDto,
  ): Prisma.BranchMenuItemOverrideUncheckedUpdateInput {
    const data: Prisma.BranchMenuItemOverrideUncheckedUpdateInput = {};

    if (this.hasOwn(body, 'priceOverrideMinor')) {
      data.priceOverrideMinor = body.priceOverrideMinor ?? null;
    }

    if (body.isAvailable !== undefined) {
      data.isAvailable = body.isAvailable;
    }

    if (body.isVisible !== undefined) {
      data.isVisible = body.isVisible;
    }

    if (this.hasOwn(body, 'sortOrder')) {
      data.sortOrder = body.sortOrder ?? null;
    }

    return data;
  }

  private toMenuItemDetail(
    item: Prisma.MenuItemGetPayload<{ select: typeof menuItemDetailSelect }>,
  ) {
    return {
      id: item.id,
      companyId: item.companyId,
      categoryId: item.categoryId,
      name: item.name,
      slug: item.slug,
      description: item.description,
      imageUrl: item.imageUrl,
      basePriceMinor: item.basePriceMinor,
      currency: item.currency,
      station: item.station,
      status: item.status,
      isFeatured: item.isFeatured,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      category: item.category,
      modifierGroups: item.modifierGroups,
      branchOverrides: item.branchOverrides.map((override) =>
        this.toBranchOverride({
          ...override,
          menuItem: {
            id: item.id,
            companyId: item.companyId,
            categoryId: item.categoryId,
            name: item.name,
            slug: item.slug,
            description: item.description,
            imageUrl: item.imageUrl,
            basePriceMinor: item.basePriceMinor,
            currency: item.currency,
            station: item.station,
            status: item.status,
            isFeatured: item.isFeatured,
            sortOrder: item.sortOrder,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            category: item.category,
          },
        }),
      ),
    };
  }

  private toBranchOverride(override: BranchOverrideRecord) {
    return {
      id: override.id,
      branchId: override.branchId,
      menuItemId: override.menuItemId,
      priceOverrideMinor: override.priceOverrideMinor,
      effectivePriceMinor:
        override.priceOverrideMinor ?? override.menuItem.basePriceMinor,
      isAvailable: override.isAvailable,
      isVisible: override.isVisible,
      sortOrder: override.sortOrder,
      createdAt: override.createdAt,
      updatedAt: override.updatedAt,
      branch: override.branch,
      menuItem: override.menuItem,
    };
  }

  private async assertReorderScope(
    recordsPromise: Promise<Array<{ id: string }>>,
    body: ReorderPayloadDto,
    message: string,
  ) {
    const records = await recordsPromise;

    if (records.length !== body.items.length) {
      throw new BadRequestException(message);
    }
  }

  private assertUniqueReorderIds(body: ReorderPayloadDto) {
    const ids = body.items.map((item) => item.id);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Reorder payload contains duplicate ids');
    }
  }

  private assertSameCompany(
    actualCompanyId: string,
    expectedCompanyId: string,
    label: string,
  ) {
    if (actualCompanyId !== expectedCompanyId) {
      throw new BadRequestException(
        `${label} does not belong to the target company`,
      );
    }
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeSearch(value?: string) {
    const normalizedValue = value?.trim();

    return normalizedValue && normalizedValue.length > 0
      ? normalizedValue
      : undefined;
  }

  private normalizeCurrency(value?: string) {
    const normalizedValue = value?.trim();

    return normalizedValue && normalizedValue.length > 0
      ? normalizedValue.toUpperCase()
      : 'EGP';
  }

  private limit(value?: number) {
    return value ?? 100;
  }

  private parseBooleanQuery(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    return value === 'true';
  }

  private toStatusCounts<TStatus extends string>(
    rows: Array<{ status: TStatus; _count: { _all: number } }>,
    statuses: readonly TStatus[],
  ): Record<TStatus, number> {
    const counts = Object.fromEntries(
      statuses.map((status) => [status, 0]),
    ) as Record<TStatus, number>;

    for (const row of rows) {
      counts[row.status] = row._count._all;
    }

    return counts;
  }

  private handleKnownWriteError(error: unknown, uniqueMessage: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(uniqueMessage);
    }

    throw error;
  }

  private hasOwn(value: object, key: string) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }
}
