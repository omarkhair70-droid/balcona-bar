import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async findCompanyMenu(companySlug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug: companySlug },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        menuCategories: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            sortOrder: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            items: {
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              select: this.menuItemSelect(false),
            },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        status: company.status,
      },
      categories: company.menuCategories.map((category) => ({
        ...category,
        items: category.items.map((item) => this.toCompanyMenuItem(item)),
      })),
    };
  }

  async findBranchMenu(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const categories = await this.prisma.menuCategory.findMany({
      where: {
        companyId: branch.company.id,
        status: 'active',
        items: {
          some: {
            status: 'active',
            branchOverrides: {
              some: {
                branchId,
                isAvailable: true,
                isVisible: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
        status: true,
        items: {
          where: {
            status: 'active',
            branchOverrides: {
              some: {
                branchId,
                isAvailable: true,
                isVisible: true,
              },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: this.menuItemSelect(true, branchId),
        },
      },
    });
    const stockAvailability = await this.inventoryService.getBranchMenuAvailability(
      branchId,
    );
    const stockAvailabilityByItemId = new Map(
      stockAvailability.items.map((item) => [item.menuItemId, item]),
    );

    return {
      branch,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        status: category.status,
        items: category.items.map((item) =>
          this.toBranchMenuItem(
            item,
            category,
            stockAvailabilityByItemId.get(item.id),
          ),
        ),
      })),
    };
  }

  async findItem(itemId: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      select: {
        ...this.menuItemSelect(false),
        branchOverrides: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            branchId: true,
            priceOverrideMinor: true,
            isAvailable: true,
            isVisible: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
            branch: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return {
      item: this.toCompanyMenuItem(item),
      category: item.category,
      branchOverrides: item.branchOverrides.map((override) => ({
        ...override,
        effectivePriceMinor: override.priceOverrideMinor ?? item.basePriceMinor,
      })),
    };
  }

  async findUnavailableBranchItems(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const overrides = await this.prisma.branchMenuItemOverride.findMany({
      where: {
        branchId,
        OR: [{ isAvailable: false }, { isVisible: false }],
        menuItem: {
          companyId: branch.company.id,
          status: {
            not: 'archived',
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { menuItem: { category: { sortOrder: 'asc' } } },
        { menuItem: { sortOrder: 'asc' } },
        { menuItem: { name: 'asc' } },
      ],
      select: {
        id: true,
        branchId: true,
        priceOverrideMinor: true,
        isAvailable: true,
        isVisible: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        menuItem: {
          select: this.menuItemSelect(false),
        },
      },
    });

    return {
      branch,
      items: overrides.map((override) => ({
        override: {
          id: override.id,
          branchId: override.branchId,
          priceOverrideMinor: override.priceOverrideMinor,
          isAvailable: override.isAvailable,
          isVisible: override.isVisible,
          sortOrder: override.sortOrder,
          createdAt: override.createdAt,
          updatedAt: override.updatedAt,
        },
        item: {
          ...this.toCompanyMenuItem(override.menuItem),
          effectivePriceMinor: override.priceOverrideMinor ?? override.menuItem.basePriceMinor,
          isAvailable: override.isAvailable,
          isVisible: override.isVisible,
        },
      })),
    };
  }

  private menuItemSelect(includeActiveModifiersOnly: boolean, branchId?: string): any {
    const modifierOptionsSelect = {
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        groupId: true,
        name: true,
        slug: true,
        priceDeltaMinor: true,
        status: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
      ...(includeActiveModifiersOnly ? { where: { status: 'active' } } : {}),
    };

    const modifierGroupsSelect = {
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        sortOrder: true,
        modifierGroup: {
          select: {
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
            options: modifierOptionsSelect,
          },
        },
      },
      ...(includeActiveModifiersOnly
        ? {
            where: {
              modifierGroup: {
                status: 'active',
              },
            },
          }
        : {}),
    };

    return {
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
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          sortOrder: true,
          status: true,
        },
      },
      modifierGroups: modifierGroupsSelect,
      ...(branchId
        ? {
            branchOverrides: {
              where: { branchId },
              select: {
                id: true,
                branchId: true,
                priceOverrideMinor: true,
                isAvailable: true,
                isVisible: true,
                sortOrder: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          }
        : {}),
    };
  }

  private toCompanyMenuItem(item) {
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
      modifiers: this.toModifierGroups(item),
    };
  }

  private toBranchMenuItem(item, category, stockAvailability?) {
    const override = item.branchOverrides[0];
    const canOrder =
      stockAvailability?.canOrder ??
      Boolean(
        override?.isAvailable &&
          override?.isVisible &&
          item.status === 'active' &&
          category.status === 'active',
      );

    return {
      id: item.id,
      companyId: item.companyId,
      categoryId: item.categoryId,
      name: item.name,
      slug: item.slug,
      description: item.description,
      imageUrl: item.imageUrl,
      basePriceMinor: item.basePriceMinor,
      effectivePriceMinor: override?.priceOverrideMinor ?? item.basePriceMinor,
      currency: item.currency,
      station: item.station,
      status: item.status,
      isFeatured: item.isFeatured,
      isAvailable: override?.isAvailable ?? false,
      isVisible: override?.isVisible ?? false,
      canOrder,
      stockStatus: stockAvailability?.stockStatus ?? 'in_stock',
      stockReasons: stockAvailability?.reasons ?? [],
      missingRequirements: stockAvailability?.missingRequirements ?? [],
      lowStockRequirements: stockAvailability?.lowStockRequirements ?? [],
      sortOrder: override?.sortOrder ?? item.sortOrder,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        status: category.status,
      },
      modifiers: this.toModifierGroups(item),
    };
  }

  private toModifierGroups(item) {
    return item.modifierGroups.map((join) => ({
      id: join.modifierGroup.id,
      menuItemModifierGroupId: join.id,
      companyId: join.modifierGroup.companyId,
      name: join.modifierGroup.name,
      slug: join.modifierGroup.slug,
      description: join.modifierGroup.description,
      selectionType: join.modifierGroup.selectionType,
      isRequired: join.modifierGroup.isRequired,
      minSelections: join.modifierGroup.minSelections,
      maxSelections: join.modifierGroup.maxSelections,
      sortOrder: join.sortOrder,
      status: join.modifierGroup.status,
      options: join.modifierGroup.options,
    }));
  }
}
