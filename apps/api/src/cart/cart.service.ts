import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto, SelectedModifierDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const DRAFT_CART_STATUS = 'draft';
const ACTIVE_STATUS = 'active';
const CLOSED_SESSION_STATUS = 'closed';
const DEFAULT_CART_CURRENCY = 'EGP';
const EXPIRED_SESSION_STATUS = 'expired';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(sessionId: string) {
    const session = await this.resolveActiveTableSession(sessionId, this.prisma);
    const cart = await this.findDraftCart(session.id, this.prisma);

    return cart ? this.toCartResponse(cart) : this.emptyCartResponse(session);
  }

  async addItem(sessionId: string, body: AddCartItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.resolveActiveTableSession(sessionId, tx);
      const preparedItem = await this.prepareCartItem(session, body, tx);
      const cart = await this.findOrCreateDraftCart(session, preparedItem.currency, tx);

      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          menuItemId: preparedItem.menuItem.id,
          quantity: body.quantity,
          notes: preparedItem.notes,
          itemNameSnapshot: preparedItem.menuItem.name,
          itemSlugSnapshot: preparedItem.menuItem.slug,
          basePriceMinorSnapshot: preparedItem.menuItem.basePriceMinor,
          effectiveBasePriceMinorSnapshot: preparedItem.effectiveBasePriceMinor,
          modifiersTotalMinorSnapshot: preparedItem.modifiersTotalMinor,
          unitPriceMinorSnapshot: preparedItem.unitPriceMinor,
          lineTotalMinorSnapshot: preparedItem.unitPriceMinor * body.quantity,
          currency: preparedItem.currency,
          modifierOptions: {
            create: preparedItem.modifierOptions.map(({ group, option }) => ({
              modifierGroupId: group.id,
              modifierOptionId: option.id,
              modifierGroupNameSnapshot: group.name,
              modifierGroupSlugSnapshot: group.slug,
              modifierOptionNameSnapshot: option.name,
              modifierOptionSlugSnapshot: option.slug,
              priceDeltaMinorSnapshot: option.priceDeltaMinor,
            })),
          },
        },
      });

      return this.toCartResponse(await this.getCartById(cart.id, tx));
    });
  }

  async updateItem(cartItemId: string, body: UpdateCartItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const cartItem = await tx.cartItem.findUnique({
        where: { id: cartItemId },
        select: {
          id: true,
          cartId: true,
          unitPriceMinorSnapshot: true,
          cart: {
            select: {
              id: true,
              status: true,
              tableSession: {
                select: this.tableSessionSelect(),
              },
            },
          },
        },
      });

      if (!cartItem) {
        throw new NotFoundException('Cart item not found');
      }

      this.assertCartEditable(cartItem.cart);

      const data: Prisma.CartItemUpdateInput = {};
      const hasNotes = Object.prototype.hasOwnProperty.call(body, 'notes');

      if (body.quantity !== undefined) {
        data.quantity = body.quantity;
        data.lineTotalMinorSnapshot = cartItem.unitPriceMinorSnapshot * body.quantity;
      }

      if (hasNotes) {
        data.notes = this.normalizeNotes(body.notes);
      }

      if (Object.keys(data).length === 0) {
        throw new BadRequestException('Provide quantity or notes to update');
      }

      await tx.cartItem.update({
        where: { id: cartItemId },
        data,
      });

      return this.toCartResponse(await this.getCartById(cartItem.cartId, tx));
    });
  }

  async removeItem(cartItemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const cartItem = await tx.cartItem.findUnique({
        where: { id: cartItemId },
        select: {
          id: true,
          cartId: true,
          cart: {
            select: {
              id: true,
              status: true,
              tableSession: {
                select: this.tableSessionSelect(),
              },
            },
          },
        },
      });

      if (!cartItem) {
        throw new NotFoundException('Cart item not found');
      }

      this.assertCartEditable(cartItem.cart);

      await tx.cartItem.delete({
        where: { id: cartItemId },
      });

      return this.toCartResponse(await this.getCartById(cartItem.cartId, tx));
    });
  }

  async clearCart(sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.resolveActiveTableSession(sessionId, tx);
      const cart = await this.findDraftCart(session.id, tx);

      if (!cart) {
        return this.emptyCartResponse(session);
      }

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      const updatedCart = await tx.cart.update({
        where: { id: cart.id },
        data: { status: DRAFT_CART_STATUS },
        include: this.cartInclude(),
      });

      return this.toCartResponse(updatedCart);
    });
  }

  async validateCart(sessionId: string) {
    const session = await this.resolveActiveTableSession(sessionId, this.prisma);
    const cart = await this.findDraftCart(session.id, this.prisma);

    if (!cart) {
      const emptyCart = this.emptyCartResponse(session);

      return {
        isValid: true,
        issues: [],
        recalculatedTotals: emptyCart.totals,
        cart: emptyCart,
      };
    }

    const validation = await this.validateResolvedCart(session, cart, this.prisma);

    return {
      ...validation,
      cart: this.toCartResponse(cart),
    };
  }

  async getValidatedDraftCartForSubmit(sessionId: string, tx: Prisma.TransactionClient) {
    const session = await this.resolveActiveTableSession(sessionId, tx);
    const cart = await this.findDraftCart(session.id, tx);

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const validation = await this.validateResolvedCart(session, cart, tx);

    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Cart is invalid',
        issues: validation.issues,
        recalculatedTotals: validation.recalculatedTotals,
      });
    }

    return {
      session,
      cart,
      totals: validation.recalculatedTotals,
    };
  }

  private async resolveActiveTableSession(sessionId: string, tx: PrismaExecutor) {
    const session = await tx.tableSession.findUnique({
      where: { id: sessionId },
      select: this.tableSessionSelect(),
    });

    if (!session) {
      throw new NotFoundException('Table session not found');
    }

    this.assertSessionActive(session);

    return session;
  }

  private assertCartEditable(cart: any) {
    if (cart.status !== DRAFT_CART_STATUS) {
      throw new BadRequestException('Cart is not a draft');
    }

    this.assertSessionActive(cart.tableSession);
  }

  private assertSessionActive(session: any) {
    if (session.status === CLOSED_SESSION_STATUS) {
      throw new BadRequestException('Table session is closed');
    }

    if (session.status === EXPIRED_SESSION_STATUS) {
      throw new BadRequestException('Table session has expired');
    }

    if (session.expiresAt && session.expiresAt <= new Date()) {
      throw new BadRequestException('Table session has expired');
    }
  }

  private async prepareCartItem(session: any, body: AddCartItemDto, tx: Prisma.TransactionClient) {
    const menuItem = await tx.menuItem.findUnique({
      where: { id: body.menuItemId },
      select: this.menuItemForCartSelect(session.branchId),
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    this.assertMenuItemCanBeAdded(menuItem, session);

    const branchOverride = menuItem.branchOverrides[0];
    const effectiveBasePriceMinor = branchOverride.priceOverrideMinor ?? menuItem.basePriceMinor;
    const modifierOptions = this.validateSelectedModifiers(menuItem, body.selectedModifiers ?? []);
    const modifiersTotalMinor = modifierOptions.reduce(
      (sum, { option }) => sum + option.priceDeltaMinor,
      0,
    );

    return {
      menuItem,
      modifierOptions,
      notes: this.normalizeNotes(body.notes),
      effectiveBasePriceMinor,
      modifiersTotalMinor,
      unitPriceMinor: effectiveBasePriceMinor + modifiersTotalMinor,
      currency: menuItem.currency,
    };
  }

  private assertMenuItemCanBeAdded(menuItem: any, session: any) {
    if (menuItem.companyId !== session.companyId) {
      throw new BadRequestException('Menu item does not belong to this table session company');
    }

    if (menuItem.status !== ACTIVE_STATUS) {
      throw new BadRequestException('Menu item is not active');
    }

    if (menuItem.category.status !== ACTIVE_STATUS) {
      throw new BadRequestException('Menu item category is not active');
    }

    const branchOverride = menuItem.branchOverrides[0];

    if (!branchOverride || !branchOverride.isAvailable || !branchOverride.isVisible) {
      throw new BadRequestException('Menu item is not available for this branch');
    }
  }

  private validateSelectedModifiers(menuItem: any, selectedModifiers: SelectedModifierDto[]) {
    const selectedByGroup = new Map<string, string[]>();

    for (const selectedModifier of selectedModifiers) {
      if (selectedByGroup.has(selectedModifier.modifierGroupId)) {
        throw new BadRequestException('Duplicate modifier group selection');
      }

      selectedByGroup.set(selectedModifier.modifierGroupId, selectedModifier.optionIds ?? []);
    }

    const attachedGroups = new Map<string, any>(
      menuItem.modifierGroups.map((join) => [join.modifierGroup.id, join.modifierGroup]),
    );

    for (const modifierGroupId of selectedByGroup.keys()) {
      const group = attachedGroups.get(modifierGroupId);

      if (!group) {
        throw new BadRequestException('Modifier group is not attached to this menu item');
      }

      if (group.status !== ACTIVE_STATUS) {
        throw new BadRequestException('Modifier group is not active');
      }
    }

    const activeGroups = Array.from(attachedGroups.values()).filter(
      (group: any) => group.status === ACTIVE_STATUS,
    );
    const selectedOptions: Array<{ group: any; option: any }> = [];

    for (const group of activeGroups) {
      const optionIds = selectedByGroup.get(group.id) ?? [];
      this.assertModifierSelectionCount(group, optionIds.length);

      const optionById = new Map<string, any>(group.options.map((option) => [option.id, option]));

      for (const optionId of optionIds) {
        const option = optionById.get(optionId);

        if (!option) {
          throw new BadRequestException('Modifier option does not belong to selected group');
        }

        if (option.status !== ACTIVE_STATUS) {
          throw new BadRequestException('Modifier option is not active');
        }

        selectedOptions.push({ group, option });
      }
    }

    return selectedOptions;
  }

  private assertModifierSelectionCount(group: any, selectedCount: number) {
    const minimumSelections = group.isRequired ? Math.max(1, group.minSelections) : group.minSelections;

    if ((group.isRequired || selectedCount > 0) && selectedCount < minimumSelections) {
      throw new BadRequestException(`Modifier group ${group.name} requires more selections`);
    }

    if (group.selectionType === 'single' && selectedCount > 1) {
      throw new BadRequestException(`Modifier group ${group.name} allows only one selection`);
    }

    if (group.maxSelections > 0 && selectedCount > group.maxSelections) {
      throw new BadRequestException(`Modifier group ${group.name} exceeds max selections`);
    }
  }

  private async findOrCreateDraftCart(session: any, currency: string, tx: Prisma.TransactionClient) {
    const existingCart = await tx.cart.findFirst({
      where: {
        tableSessionId: session.id,
        status: DRAFT_CART_STATUS,
      },
    });

    if (existingCart) {
      if (existingCart.currency !== currency) {
        throw new BadRequestException('Mixed cart currencies are not supported');
      }

      return existingCart;
    }

    return tx.cart.create({
      data: {
        tableSessionId: session.id,
        companyId: session.companyId,
        branchId: session.branchId,
        status: DRAFT_CART_STATUS,
        currency,
      },
    });
  }

  private async findDraftCart(sessionId: string, tx: PrismaExecutor) {
    return tx.cart.findFirst({
      where: {
        tableSessionId: sessionId,
        status: DRAFT_CART_STATUS,
      },
      include: this.cartInclude(),
    });
  }

  private async getCartById(cartId: string, tx: PrismaExecutor) {
    const cart = await tx.cart.findUnique({
      where: { id: cartId },
      include: this.cartInclude(),
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }

  private async validateResolvedCart(session: any, cart: any, tx: PrismaExecutor) {
    const issues: any[] = [];
    let subtotalMinor = 0;
    let totalQuantity = 0;

    for (const item of cart.items) {
      const validation = await this.validateCartItem(session, cart.currency, item, tx);
      issues.push(...validation.issues);
      subtotalMinor += validation.lineTotalMinor;
      totalQuantity += item.quantity;
    }

    return {
      isValid: issues.length === 0,
      issues,
      recalculatedTotals: {
        subtotalMinor,
        totalQuantity,
        itemCount: cart.items.length,
        currency: cart.currency,
      },
    };
  }

  private async validateCartItem(session: any, cartCurrency: string, cartItem: any, tx: PrismaExecutor) {
    const issues: any[] = [];
    const currentItem = await tx.menuItem.findUnique({
      where: { id: cartItem.menuItemId },
      select: this.menuItemForCartSelect(session.branchId),
    });

    if (!currentItem) {
      issues.push(
        this.validationIssue('item_missing', 'Menu item no longer exists', cartItem, {
          menuItemId: cartItem.menuItemId,
        }),
      );

      return {
        issues,
        lineTotalMinor: cartItem.lineTotalMinorSnapshot,
      };
    }

    if (currentItem.companyId !== session.companyId) {
      issues.push(
        this.validationIssue('item_company_mismatch', 'Menu item no longer belongs to session company', cartItem),
      );
    }

    if (currentItem.status !== ACTIVE_STATUS) {
      issues.push(this.validationIssue('item_inactive', 'Menu item is no longer active', cartItem));
    }

    if (currentItem.category.status !== ACTIVE_STATUS) {
      issues.push(this.validationIssue('category_inactive', 'Menu item category is no longer active', cartItem));
    }

    const branchOverride = currentItem.branchOverrides[0];

    if (!branchOverride) {
      issues.push(
        this.validationIssue('item_not_configured_for_branch', 'Menu item is no longer configured for this branch', cartItem),
      );
    } else {
      if (!branchOverride.isAvailable) {
        issues.push(this.validationIssue('item_unavailable', 'Menu item is no longer available in this branch', cartItem));
      }

      if (!branchOverride.isVisible) {
        issues.push(this.validationIssue('item_hidden', 'Menu item is no longer visible in this branch', cartItem));
      }
    }

    if (currentItem.currency !== cartItem.currency || currentItem.currency !== cartCurrency) {
      issues.push(
        this.validationIssue('item_currency_changed', 'Menu item currency differs from cart currency', cartItem, {
          snapshotCurrency: cartItem.currency,
          currentCurrency: currentItem.currency,
          cartCurrency,
        }),
      );
    }

    const currentBasePriceMinor = branchOverride?.priceOverrideMinor ?? currentItem.basePriceMinor;

    if (currentBasePriceMinor !== cartItem.effectiveBasePriceMinorSnapshot) {
      issues.push(
        this.validationIssue('base_price_changed', 'Menu item current base price differs from cart snapshot', cartItem, {
          snapshotBasePriceMinor: cartItem.effectiveBasePriceMinorSnapshot,
          currentBasePriceMinor,
        }),
      );
    }

    const modifierValidation = this.validateCartItemModifiers(currentItem, cartItem);
    issues.push(...modifierValidation.issues);

    const currentUnitPriceMinor = currentBasePriceMinor + modifierValidation.modifiersTotalMinor;

    if (currentUnitPriceMinor !== cartItem.unitPriceMinorSnapshot) {
      issues.push(
        this.validationIssue('unit_price_changed', 'Current unit price differs from cart snapshot', cartItem, {
          snapshotUnitPriceMinor: cartItem.unitPriceMinorSnapshot,
          currentUnitPriceMinor,
        }),
      );
    }

    return {
      issues,
      lineTotalMinor: currentUnitPriceMinor * cartItem.quantity,
    };
  }

  private validateCartItemModifiers(currentItem: any, cartItem: any) {
    const issues: any[] = [];
    const attachedGroups = new Map<string, any>(
      currentItem.modifierGroups.map((join) => [join.modifierGroup.id, join.modifierGroup]),
    );
    const selectedByGroup = new Map<string, any[]>();
    let modifiersTotalMinor = 0;

    for (const selectedOption of cartItem.modifierOptions) {
      const groupSelections = selectedByGroup.get(selectedOption.modifierGroupId) ?? [];
      groupSelections.push(selectedOption);
      selectedByGroup.set(selectedOption.modifierGroupId, groupSelections);

      const group = attachedGroups.get(selectedOption.modifierGroupId);

      if (!group) {
        issues.push(
          this.validationIssue('modifier_group_detached', 'Modifier group is no longer attached to this item', cartItem, {
            modifierGroupId: selectedOption.modifierGroupId,
          }),
        );
        modifiersTotalMinor += selectedOption.priceDeltaMinorSnapshot;
        continue;
      }

      if (group.status !== ACTIVE_STATUS) {
        issues.push(
          this.validationIssue('modifier_group_inactive', 'Modifier group is no longer active', cartItem, {
            modifierGroupId: group.id,
            modifierGroupName: group.name,
          }),
        );
      }

      const currentOption = group.options.find((option) => option.id === selectedOption.modifierOptionId);

      if (!currentOption) {
        issues.push(
          this.validationIssue('modifier_option_missing', 'Modifier option no longer belongs to its group', cartItem, {
            modifierGroupId: group.id,
            modifierOptionId: selectedOption.modifierOptionId,
          }),
        );
        modifiersTotalMinor += selectedOption.priceDeltaMinorSnapshot;
        continue;
      }

      if (currentOption.status !== ACTIVE_STATUS) {
        issues.push(
          this.validationIssue('modifier_option_inactive', 'Modifier option is no longer active', cartItem, {
            modifierGroupId: group.id,
            modifierOptionId: currentOption.id,
            modifierOptionName: currentOption.name,
          }),
        );
      }

      if (currentOption.priceDeltaMinor !== selectedOption.priceDeltaMinorSnapshot) {
        issues.push(
          this.validationIssue('modifier_price_changed', 'Modifier option price differs from cart snapshot', cartItem, {
            modifierOptionId: currentOption.id,
            snapshotPriceDeltaMinor: selectedOption.priceDeltaMinorSnapshot,
            currentPriceDeltaMinor: currentOption.priceDeltaMinor,
          }),
        );
      }

      modifiersTotalMinor += currentOption.priceDeltaMinor;
    }

    const activeGroups = Array.from(attachedGroups.values()).filter(
      (group: any) => group.status === ACTIVE_STATUS,
    );

    for (const group of activeGroups) {
      issues.push(...this.validateModifierSelectionCountIssue(group, selectedByGroup.get(group.id)?.length ?? 0, cartItem));
    }

    return {
      issues,
      modifiersTotalMinor,
    };
  }

  private validateModifierSelectionCountIssue(group: any, selectedCount: number, cartItem: any) {
    const issues: any[] = [];
    const minimumSelections = group.isRequired ? Math.max(1, group.minSelections) : group.minSelections;

    if ((group.isRequired || selectedCount > 0) && selectedCount < minimumSelections) {
      issues.push(
        this.validationIssue('modifier_min_selection_not_met', 'Modifier group has too few selections', cartItem, {
          modifierGroupId: group.id,
          modifierGroupName: group.name,
          selectedCount,
          minimumSelections,
        }),
      );
    }

    if (group.selectionType === 'single' && selectedCount > 1) {
      issues.push(
        this.validationIssue('modifier_single_selection_exceeded', 'Single-select modifier group has too many selections', cartItem, {
          modifierGroupId: group.id,
          modifierGroupName: group.name,
          selectedCount,
        }),
      );
    }

    if (group.maxSelections > 0 && selectedCount > group.maxSelections) {
      issues.push(
        this.validationIssue('modifier_max_selection_exceeded', 'Modifier group has too many selections', cartItem, {
          modifierGroupId: group.id,
          modifierGroupName: group.name,
          selectedCount,
          maxSelections: group.maxSelections,
        }),
      );
    }

    return issues;
  }

  private validationIssue(code: string, message: string, cartItem: any, details: Record<string, unknown> = {}) {
    return {
      code,
      message,
      cartItemId: cartItem.id,
      menuItemId: cartItem.menuItemId,
      ...details,
    };
  }

  private toCartResponse(cart: any) {
    const subtotalMinor = cart.items.reduce(
      (sum: number, item: any) => sum + item.lineTotalMinorSnapshot,
      0,
    );
    const totalQuantity = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

    return {
      cart: {
        id: cart.id,
        tableSessionId: cart.tableSessionId,
        companyId: cart.companyId,
        branchId: cart.branchId,
        status: cart.status,
        currency: cart.currency,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
      },
      items: cart.items.map((item: any) => ({
        id: item.id,
        cartId: item.cartId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
        itemNameSnapshot: item.itemNameSnapshot,
        itemSlugSnapshot: item.itemSlugSnapshot,
        basePriceMinorSnapshot: item.basePriceMinorSnapshot,
        effectiveBasePriceMinorSnapshot: item.effectiveBasePriceMinorSnapshot,
        modifiersTotalMinorSnapshot: item.modifiersTotalMinorSnapshot,
        unitPriceMinorSnapshot: item.unitPriceMinorSnapshot,
        lineTotalMinorSnapshot: item.lineTotalMinorSnapshot,
        currency: item.currency,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        modifierOptions: item.modifierOptions.map((option: any) => ({
          id: option.id,
          cartItemId: option.cartItemId,
          modifierGroupId: option.modifierGroupId,
          modifierOptionId: option.modifierOptionId,
          modifierGroupNameSnapshot: option.modifierGroupNameSnapshot,
          modifierGroupSlugSnapshot: option.modifierGroupSlugSnapshot,
          modifierOptionNameSnapshot: option.modifierOptionNameSnapshot,
          modifierOptionSlugSnapshot: option.modifierOptionSlugSnapshot,
          priceDeltaMinorSnapshot: option.priceDeltaMinorSnapshot,
          createdAt: option.createdAt,
        })),
      })),
      totals: {
        subtotalMinor,
        totalQuantity,
        itemCount: cart.items.length,
        currency: cart.currency,
      },
    };
  }

  private emptyCartResponse(session: any, currency = DEFAULT_CART_CURRENCY) {
    return {
      cart: {
        id: null,
        tableSessionId: session.id,
        companyId: session.companyId,
        branchId: session.branchId,
        status: DRAFT_CART_STATUS,
        currency,
        createdAt: null,
        updatedAt: null,
      },
      items: [],
      totals: {
        subtotalMinor: 0,
        totalQuantity: 0,
        itemCount: 0,
        currency,
      },
    };
  }

  private normalizeNotes(notes?: string | null) {
    if (notes === undefined) {
      return undefined;
    }

    if (notes === null) {
      return null;
    }

    const trimmedNotes = notes.trim();

    return trimmedNotes.length > 0 ? trimmedNotes : null;
  }

  private tableSessionSelect() {
    return {
      id: true,
      companyId: true,
      branchId: true,
      tableId: true,
      status: true,
      expiresAt: true,
    };
  }

  private cartInclude() {
    return {
      items: {
        orderBy: [{ createdAt: 'asc' as const }],
        include: {
          modifierOptions: {
            orderBy: [{ createdAt: 'asc' as const }],
          },
        },
      },
    };
  }

  private menuItemForCartSelect(branchId: string) {
    return {
      id: true,
      companyId: true,
      categoryId: true,
      name: true,
      slug: true,
      basePriceMinor: true,
      currency: true,
      status: true,
      category: {
        select: {
          id: true,
          status: true,
        },
      },
      branchOverrides: {
        where: { branchId },
        select: {
          id: true,
          priceOverrideMinor: true,
          isAvailable: true,
          isVisible: true,
        },
      },
      modifierGroups: {
        orderBy: { sortOrder: 'asc' as const },
        select: {
          modifierGroup: {
            select: {
              id: true,
              name: true,
              slug: true,
              selectionType: true,
              isRequired: true,
              minSelections: true,
              maxSelections: true,
              status: true,
              options: {
                select: {
                  id: true,
                  groupId: true,
                  name: true,
                  slug: true,
                  priceDeltaMinor: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    };
  }
}
