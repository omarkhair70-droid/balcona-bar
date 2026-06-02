import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AutoAcceptDecision,
  BranchStatus,
  ManualReviewReasonCode,
  MenuCategoryStatus,
  MenuItemStatus,
  ModifierGroupStatus,
  ModifierOptionStatus,
  OrderEventActorType,
  OrderEventType,
  OrderStatus,
  Prisma,
  SmartCashierMode,
  SmartCashierRuleScope,
} from '@prisma/client';
import { PresenceNotificationsService } from '../presence-notifications/presence-notifications.service';
import { PreparationTasksService } from '../preparation-tasks/preparation-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { CreateSmartCashierReviewRuleDto } from './dto/create-smart-cashier-review-rule.dto';
import { UpdateSmartCashierReviewRuleDto } from './dto/update-smart-cashier-review-rule.dto';
import { UpsertBranchSmartCashierSettingsDto } from './dto/upsert-branch-smart-cashier-settings.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const smartCashierOrderSelect = {
  id: true,
  companyId: true,
  branchId: true,
  tableSessionId: true,
  orderNumber: true,
  status: true,
  currency: true,
  subtotalMinor: true,
  totalQuantity: true,
  itemCount: true,
  customerNote: true,
  branch: {
    select: {
      id: true,
      companyId: true,
      status: true,
    },
  },
  items: {
    orderBy: [{ createdAt: 'asc' as const }],
    select: {
      id: true,
      menuItemId: true,
      itemNameSnapshot: true,
      modifierOptions: {
        orderBy: [{ createdAt: 'asc' as const }],
        select: {
          id: true,
          modifierGroupId: true,
          modifierOptionId: true,
          modifierGroupNameSnapshot: true,
          modifierOptionNameSnapshot: true,
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

type SmartCashierOrder = Prisma.OrderGetPayload<{
  select: typeof smartCashierOrderSelect;
}>;

const branchSmartCashierSettingsSelect = {
  id: true,
  companyId: true,
  branchId: true,
  mode: true,
  enabled: true,
  maxAutoAcceptSubtotalMinor: true,
  requirePaymentBeforeAutoAccept: true,
  reviewCustomerNotes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSmartCashierSettingsSelect;

type BranchSmartCashierSettingsRecord =
  Prisma.BranchSmartCashierSettingsGetPayload<{
    select: typeof branchSmartCashierSettingsSelect;
  }>;

type BranchContext = {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  status: BranchStatus;
};

type SmartCashierSettingsResponse = {
  id: string | null;
  companyId: string;
  branchId: string;
  source: 'branch' | 'default';
  enabled: boolean;
  mode: SmartCashierMode;
  maxAutoAcceptSubtotalMinor: number | null;
  requirePaymentBeforeAutoAccept: boolean;
  reviewCustomerNotes: boolean;
};

type SmartCashierReviewReason = {
  code: ManualReviewReasonCode;
  message: string;
  details?: Record<string, unknown>;
};

type SmartCashierOrderSummary = {
  id: string;
  companyId: string;
  branchId: string;
  tableSessionId: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  subtotalMinor: number;
  totalQuantity: number;
  itemCount: number;
  customerNotePresent: boolean;
};

export type SmartCashierEvaluationResult = {
  decision: AutoAcceptDecision;
  reasons: SmartCashierReviewReason[];
  settings: SmartCashierSettingsResponse;
  order: SmartCashierOrderSummary;
};

type SmartCashierAttemptResult = SmartCashierEvaluationResult & {
  autoAccepted: boolean;
  stored: boolean;
};

type SmartCashierSettingsWriteData = {
  enabled?: boolean;
  mode?: SmartCashierMode;
  maxAutoAcceptSubtotalMinor?: number | null;
  requirePaymentBeforeAutoAccept?: boolean;
  reviewCustomerNotes?: boolean;
};

@Injectable()
export class SmartCashierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preparationTasksService: PreparationTasksService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async getBranchSettings(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        companyId: true,
        name: true,
        slug: true,
        status: true,
        smartCashierSettings: {
          select: branchSmartCashierSettingsSelect,
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return {
      branch: this.toBranchResponse(branch),
      settings: branch.smartCashierSettings
        ? this.toSettingsResponse(branch.smartCashierSettings)
        : this.defaultSettings(branch.companyId, branch.id),
    };
  }

  async upsertBranchSettings(
    branchId: string,
    body: UpsertBranchSmartCashierSettingsDto,
  ) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const data = this.toSettingsWriteData(body);
    const settings = await this.prisma.branchSmartCashierSettings.upsert({
      where: { branchId },
      create: {
        companyId: branch.companyId,
        branchId: branch.id,
        ...data,
      },
      update: data,
      select: branchSmartCashierSettingsSelect,
    });

    return {
      branch: this.toBranchResponse(branch),
      settings: this.toSettingsResponse(settings),
    };
  }

  async listReviewRules(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const reviewRules = await this.prisma.smartCashierReviewRule.findMany({
      where: { branchId },
      orderBy: [{ scope: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    return {
      branch: this.toBranchResponse(branch),
      reviewRules,
    };
  }

  async createReviewRule(
    branchId: string,
    body: CreateSmartCashierReviewRuleDto,
  ) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const scope: SmartCashierRuleScope = body.scope;
    const scopedIds = await this.normalizeReviewRuleScope(
      branch,
      scope,
      body.menuItemId ?? null,
      body.categoryId ?? null,
      this.prisma,
    );
    const reviewRule = await this.prisma.smartCashierReviewRule.create({
      data: {
        companyId: branch.companyId,
        branchId: branch.id,
        scope,
        menuItemId: scopedIds.menuItemId,
        categoryId: scopedIds.categoryId,
        reasonCode: body.reasonCode,
        enabled: body.enabled ?? true,
        note: this.normalizeOptionalText(body.note),
      },
    });

    return {
      branch: this.toBranchResponse(branch),
      reviewRule,
    };
  }

  async updateReviewRule(
    ruleId: string,
    body: UpdateSmartCashierReviewRuleDto,
  ) {
    const existingRule = await this.prisma.smartCashierReviewRule.findUnique({
      where: { id: ruleId },
      select: {
        id: true,
        branchId: true,
        scope: true,
        menuItemId: true,
        categoryId: true,
      },
    });

    if (!existingRule) {
      throw new NotFoundException('Smart cashier review rule not found');
    }

    const branch = await this.findBranchOrThrow(
      existingRule.branchId,
      this.prisma,
    );
    const scope: SmartCashierRuleScope = body.scope ?? existingRule.scope;
    const menuItemId = this.hasOwn(body, 'menuItemId')
      ? (body.menuItemId ?? null)
      : existingRule.menuItemId;
    const categoryId = this.hasOwn(body, 'categoryId')
      ? (body.categoryId ?? null)
      : existingRule.categoryId;
    const scopedIds = await this.normalizeReviewRuleScope(
      branch,
      scope,
      menuItemId,
      categoryId,
      this.prisma,
    );
    const data: Prisma.SmartCashierReviewRuleUpdateInput = {
      scope,
      menuItem: scopedIds.menuItemId
        ? { connect: { id: scopedIds.menuItemId } }
        : { disconnect: true },
      category: scopedIds.categoryId
        ? { connect: { id: scopedIds.categoryId } }
        : { disconnect: true },
    };

    if (body.reasonCode !== undefined) {
      data.reasonCode = body.reasonCode;
    }

    if (body.enabled !== undefined) {
      data.enabled = body.enabled;
    }

    if (this.hasOwn(body, 'note')) {
      data.note = this.normalizeOptionalText(body.note);
    }

    const reviewRule = await this.prisma.smartCashierReviewRule.update({
      where: { id: ruleId },
      data,
    });

    return {
      branch: this.toBranchResponse(branch),
      reviewRule,
    };
  }

  async disableReviewRule(ruleId: string) {
    const reviewRule = await this.prisma.smartCashierReviewRule.findUnique({
      where: { id: ruleId },
      select: { id: true, branchId: true },
    });

    if (!reviewRule) {
      throw new NotFoundException('Smart cashier review rule not found');
    }

    const branch = await this.findBranchOrThrow(
      reviewRule.branchId,
      this.prisma,
    );
    const disabledRule = await this.prisma.smartCashierReviewRule.update({
      where: { id: ruleId },
      data: { enabled: false },
    });

    return {
      branch: this.toBranchResponse(branch),
      reviewRule: disabledRule,
    };
  }

  async evaluateOrderForAutoAccept(
    orderId: string,
    tx: PrismaExecutor = this.prisma,
  ): Promise<SmartCashierEvaluationResult> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: smartCashierOrderSelect,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const settingsRecord = await tx.branchSmartCashierSettings.findUnique({
      where: { branchId: order.branchId },
      select: branchSmartCashierSettingsSelect,
    });
    const settings = settingsRecord
      ? this.toSettingsResponse(settingsRecord)
      : this.defaultSettings(order.companyId, order.branchId);
    const reasons: SmartCashierReviewReason[] = [];

    if (!settingsRecord || !settings.enabled) {
      this.addReason(
        reasons,
        ManualReviewReasonCode.smart_cashier_disabled,
        'Smart cashier is not enabled for this branch.',
      );

      return this.toEvaluationResult(order, settings, reasons);
    }

    if (settings.mode === SmartCashierMode.manual_only) {
      this.addReason(
        reasons,
        ManualReviewReasonCode.branch_manual_only,
        'Branch is configured for manual cashier review.',
      );

      return this.toEvaluationResult(order, settings, reasons);
    }

    if (settings.mode === SmartCashierMode.assisted) {
      this.addReason(
        reasons,
        ManualReviewReasonCode.assisted_mode_requires_review,
        'Assisted mode records a recommendation but still requires cashier review.',
      );

      return this.toEvaluationResult(order, settings, reasons);
    }

    if (order.status !== OrderStatus.submitted) {
      this.addReason(
        reasons,
        ManualReviewReasonCode.unknown,
        'Only submitted orders can be auto accepted.',
        { status: order.status },
      );

      return this.toEvaluationResult(order, settings, reasons);
    }

    if (order.branch.status !== BranchStatus.active) {
      this.addReason(
        reasons,
        ManualReviewReasonCode.branch_closed,
        'Branch is not active.',
        { branchStatus: order.branch.status },
      );
    }

    if (
      settings.maxAutoAcceptSubtotalMinor !== null &&
      order.subtotalMinor > settings.maxAutoAcceptSubtotalMinor
    ) {
      this.addReason(
        reasons,
        ManualReviewReasonCode.order_amount_too_high,
        'Order subtotal is above the branch auto-accept limit.',
        {
          subtotalMinor: order.subtotalMinor,
          maxAutoAcceptSubtotalMinor: settings.maxAutoAcceptSubtotalMinor,
        },
      );
    }

    if (settings.requirePaymentBeforeAutoAccept) {
      this.addReason(
        reasons,
        ManualReviewReasonCode.payment_required,
        'Branch requires payment before auto-accept, and payment is not implemented yet.',
      );
    }

    if (settings.reviewCustomerNotes && order.customerNote?.trim()) {
      this.addReason(
        reasons,
        ManualReviewReasonCode.customer_note_present,
        'Customer note is present and requires cashier review.',
      );
    }

    await this.appendItemAndReviewRuleReasons(order, reasons, tx);
    await this.appendModifierAvailabilityReasons(order, reasons, tx);

    return this.toEvaluationResult(order, settings, reasons);
  }

  async attemptAutoAcceptOrder(
    orderId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SmartCashierAttemptResult> {
    if (tx) {
      return this.attemptAutoAcceptOrderInTransaction(orderId, tx);
    }

    return this.prisma.$transaction((innerTx) =>
      this.attemptAutoAcceptOrderInTransaction(orderId, innerTx),
    );
  }

  private async attemptAutoAcceptOrderInTransaction(
    orderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<SmartCashierAttemptResult> {
    const evaluation = await this.evaluateOrderForAutoAccept(orderId, tx);

    await this.realtimeEventsService.recordSmartCashierEvaluated(
      orderId,
      evaluation,
      tx,
    );

    if (evaluation.order.status !== OrderStatus.submitted) {
      return {
        ...evaluation,
        autoAccepted: false,
        stored: false,
      };
    }

    const now = new Date();

    if (evaluation.decision === AutoAcceptDecision.requires_manual_review) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          autoAcceptDecision: AutoAcceptDecision.requires_manual_review,
          manualReviewReasons: this.toInputJson(evaluation.reasons),
          smartCashierModeSnapshot: evaluation.settings.mode,
          autoAcceptEvaluatedAt: now,
        },
      });

      await this.realtimeEventsService.recordSmartCashierManualReviewRequired(
        orderId,
        evaluation,
        tx,
      );

      return {
        ...evaluation,
        autoAccepted: false,
        stored: true,
      };
    }

    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.submitted,
      },
      data: {
        status: OrderStatus.cashier_accepted,
        cashierAcceptedAt: now,
        autoAcceptedAt: now,
        autoAcceptDecision: AutoAcceptDecision.auto_accepted,
        manualReviewReasons: Prisma.DbNull,
        smartCashierModeSnapshot: evaluation.settings.mode,
        autoAcceptEvaluatedAt: now,
      },
    });

    if (updatedOrder.count === 0) {
      return {
        ...evaluation,
        autoAccepted: false,
        stored: false,
      };
    }

    await tx.orderEvent.create({
      data: {
        orderId,
        type: OrderEventType.cashier_accepted,
        actorType: OrderEventActorType.system,
        metadata: {
          source: 'smart_cashier_auto_accept',
          decision: AutoAcceptDecision.auto_accepted,
        },
      },
    });

    await this.preparationTasksService.createTasksForAcceptedOrder(
      orderId,
      undefined,
      tx,
    );
    await this.presenceNotificationsService.createOrderAcceptedNotification(
      orderId,
      tx,
    );
    await this.realtimeEventsService.recordOrderAccepted(orderId, tx);
    await this.realtimeEventsService.recordSmartCashierAutoAccepted(
      orderId,
      evaluation,
      tx,
    );

    return {
      ...evaluation,
      autoAccepted: true,
      stored: true,
    };
  }

  private async appendItemAndReviewRuleReasons(
    order: SmartCashierOrder,
    reasons: SmartCashierReviewReason[],
    tx: PrismaExecutor,
  ) {
    const menuItemIds = this.uniqueValues(
      order.items.map((item) => item.menuItemId),
    );

    if (menuItemIds.length === 0) {
      this.addReason(
        reasons,
        ManualReviewReasonCode.cart_invalid,
        'Order has no items to auto accept.',
      );

      return;
    }

    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: {
        id: true,
        categoryId: true,
        status: true,
        category: {
          select: {
            id: true,
            status: true,
          },
        },
        branchOverrides: {
          where: { branchId: order.branchId },
          select: {
            isAvailable: true,
            isVisible: true,
          },
        },
      },
    });
    const menuItemsById = new Map(
      menuItems.map((menuItem) => [menuItem.id, menuItem]),
    );

    for (const item of order.items) {
      const menuItem = menuItemsById.get(item.menuItemId);

      if (!menuItem) {
        this.addReason(
          reasons,
          ManualReviewReasonCode.item_unavailable,
          'Menu item is no longer available.',
          {
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            itemNameSnapshot: item.itemNameSnapshot,
          },
        );
        continue;
      }

      if (
        menuItem.status !== MenuItemStatus.active ||
        menuItem.category.status !== MenuCategoryStatus.active
      ) {
        this.addReason(
          reasons,
          ManualReviewReasonCode.item_unavailable,
          'Menu item or category is not active.',
          {
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            itemStatus: menuItem.status,
            categoryId: menuItem.categoryId,
            categoryStatus: menuItem.category.status,
          },
        );
      }

      const branchOverride = menuItem.branchOverrides[0];

      if (
        branchOverride &&
        (!branchOverride.isAvailable || !branchOverride.isVisible)
      ) {
        this.addReason(
          reasons,
          ManualReviewReasonCode.item_unavailable,
          'Menu item is hidden or unavailable for this branch.',
          {
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            isAvailable: branchOverride.isAvailable,
            isVisible: branchOverride.isVisible,
          },
        );
      }
    }

    const reviewRules = await tx.smartCashierReviewRule.findMany({
      where: {
        branchId: order.branchId,
        enabled: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    for (const rule of reviewRules) {
      if (rule.scope === SmartCashierRuleScope.branch) {
        this.addReviewRuleReason(reasons, rule);
        continue;
      }

      for (const item of order.items) {
        const menuItem = menuItemsById.get(item.menuItemId);
        const appliesToItem =
          rule.scope === SmartCashierRuleScope.menu_item &&
          rule.menuItemId === item.menuItemId;
        const appliesToCategory =
          rule.scope === SmartCashierRuleScope.category &&
          rule.categoryId === menuItem?.categoryId;

        if (appliesToItem || appliesToCategory) {
          this.addReviewRuleReason(reasons, rule, {
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            itemNameSnapshot: item.itemNameSnapshot,
            categoryId: menuItem?.categoryId,
          });
        }
      }
    }
  }

  private async appendModifierAvailabilityReasons(
    order: SmartCashierOrder,
    reasons: SmartCashierReviewReason[],
    tx: PrismaExecutor,
  ) {
    const modifierGroupIds = this.uniqueValues(
      order.items.flatMap((item) =>
        item.modifierOptions.map((option) => option.modifierGroupId),
      ),
    );
    const modifierOptionIds = this.uniqueValues(
      order.items.flatMap((item) =>
        item.modifierOptions.map((option) => option.modifierOptionId),
      ),
    );

    if (modifierGroupIds.length === 0 && modifierOptionIds.length === 0) {
      return;
    }

    const [modifierGroups, modifierOptions] = await Promise.all([
      tx.modifierGroup.findMany({
        where: { id: { in: modifierGroupIds } },
        select: {
          id: true,
          status: true,
        },
      }),
      tx.modifierOption.findMany({
        where: { id: { in: modifierOptionIds } },
        select: {
          id: true,
          groupId: true,
          status: true,
        },
      }),
    ]);
    const modifierGroupsById = new Map(
      modifierGroups.map((group) => [group.id, group]),
    );
    const modifierOptionsById = new Map(
      modifierOptions.map((option) => [option.id, option]),
    );

    for (const item of order.items) {
      for (const selectedOption of item.modifierOptions) {
        const group = modifierGroupsById.get(selectedOption.modifierGroupId);
        const option = modifierOptionsById.get(selectedOption.modifierOptionId);

        if (!group || group.status !== ModifierGroupStatus.active) {
          this.addReason(
            reasons,
            ManualReviewReasonCode.modifier_unavailable,
            'Modifier group is not active.',
            {
              orderItemId: item.id,
              modifierGroupId: selectedOption.modifierGroupId,
              modifierGroupNameSnapshot:
                selectedOption.modifierGroupNameSnapshot,
              status: group?.status ?? null,
            },
          );
        }

        if (
          !option ||
          option.status !== ModifierOptionStatus.active ||
          option.groupId !== selectedOption.modifierGroupId
        ) {
          this.addReason(
            reasons,
            ManualReviewReasonCode.modifier_unavailable,
            'Modifier option is not active or no longer belongs to the selected group.',
            {
              orderItemId: item.id,
              modifierOptionId: selectedOption.modifierOptionId,
              modifierOptionNameSnapshot:
                selectedOption.modifierOptionNameSnapshot,
              status: option?.status ?? null,
              currentGroupId: option?.groupId ?? null,
            },
          );
        }
      }
    }
  }

  private async findBranchOrThrow(
    branchId: string,
    tx: PrismaExecutor,
  ): Promise<BranchContext> {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        companyId: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async normalizeReviewRuleScope(
    branch: BranchContext,
    scope: SmartCashierRuleScope,
    menuItemId: string | null,
    categoryId: string | null,
    tx: PrismaExecutor,
  ) {
    if (scope === SmartCashierRuleScope.branch) {
      if (menuItemId || categoryId) {
        throw new BadRequestException(
          'Branch review rules cannot include menuItemId or categoryId',
        );
      }

      return { menuItemId: null, categoryId: null };
    }

    if (scope === SmartCashierRuleScope.menu_item) {
      if (!menuItemId) {
        throw new BadRequestException(
          'menu_item review rules require menuItemId',
        );
      }

      if (categoryId) {
        throw new BadRequestException(
          'menu_item review rules cannot include categoryId',
        );
      }

      await this.assertMenuItemBelongsToCompany(
        menuItemId,
        branch.companyId,
        tx,
      );

      return { menuItemId, categoryId: null };
    }

    if (!categoryId) {
      throw new BadRequestException('category review rules require categoryId');
    }

    if (menuItemId) {
      throw new BadRequestException(
        'category review rules cannot include menuItemId',
      );
    }

    await this.assertCategoryBelongsToCompany(categoryId, branch.companyId, tx);

    return { menuItemId: null, categoryId };
  }

  private async assertMenuItemBelongsToCompany(
    menuItemId: string,
    companyId: string,
    tx: PrismaExecutor,
  ) {
    const menuItem = await tx.menuItem.findUnique({
      where: { id: menuItemId },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    if (menuItem.companyId !== companyId) {
      throw new BadRequestException(
        'Menu item does not belong to branch company',
      );
    }
  }

  private async assertCategoryBelongsToCompany(
    categoryId: string,
    companyId: string,
    tx: PrismaExecutor,
  ) {
    const category = await tx.menuCategory.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Menu category not found');
    }

    if (category.companyId !== companyId) {
      throw new BadRequestException(
        'Menu category does not belong to branch company',
      );
    }
  }

  private toSettingsWriteData(
    body: UpsertBranchSmartCashierSettingsDto,
  ): SmartCashierSettingsWriteData {
    const data: SmartCashierSettingsWriteData = {};

    if (body.enabled !== undefined) {
      data.enabled = body.enabled;
    }

    if (body.mode !== undefined) {
      data.mode = body.mode;
    }

    if (this.hasOwn(body, 'maxAutoAcceptSubtotalMinor')) {
      data.maxAutoAcceptSubtotalMinor = body.maxAutoAcceptSubtotalMinor ?? null;
    }

    if (body.requirePaymentBeforeAutoAccept !== undefined) {
      data.requirePaymentBeforeAutoAccept = body.requirePaymentBeforeAutoAccept;
    }

    if (body.reviewCustomerNotes !== undefined) {
      data.reviewCustomerNotes = body.reviewCustomerNotes;
    }

    return data;
  }

  private toEvaluationResult(
    order: SmartCashierOrder,
    settings: SmartCashierSettingsResponse,
    reasons: SmartCashierReviewReason[],
  ): SmartCashierEvaluationResult {
    return {
      decision:
        reasons.length === 0
          ? AutoAcceptDecision.auto_accepted
          : AutoAcceptDecision.requires_manual_review,
      reasons,
      settings,
      order: this.toOrderSummary(order),
    };
  }

  private toSettingsResponse(
    settings: BranchSmartCashierSettingsRecord,
  ): SmartCashierSettingsResponse {
    return {
      id: settings.id,
      companyId: settings.companyId,
      branchId: settings.branchId,
      source: 'branch',
      enabled: settings.enabled,
      mode: settings.mode,
      maxAutoAcceptSubtotalMinor: settings.maxAutoAcceptSubtotalMinor,
      requirePaymentBeforeAutoAccept: settings.requirePaymentBeforeAutoAccept,
      reviewCustomerNotes: settings.reviewCustomerNotes,
    };
  }

  private defaultSettings(
    companyId: string,
    branchId: string,
  ): SmartCashierSettingsResponse {
    return {
      id: null,
      companyId,
      branchId,
      source: 'default',
      enabled: false,
      mode: SmartCashierMode.manual_only,
      maxAutoAcceptSubtotalMinor: null,
      requirePaymentBeforeAutoAccept: false,
      reviewCustomerNotes: true,
    };
  }

  private toBranchResponse(branch: BranchContext) {
    return {
      id: branch.id,
      companyId: branch.companyId,
      name: branch.name,
      slug: branch.slug,
      status: branch.status,
    };
  }

  private toOrderSummary(order: SmartCashierOrder): SmartCashierOrderSummary {
    return {
      id: order.id,
      companyId: order.companyId,
      branchId: order.branchId,
      tableSessionId: order.tableSessionId,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      totalQuantity: order.totalQuantity,
      itemCount: order.itemCount,
      customerNotePresent: Boolean(order.customerNote?.trim()),
    };
  }

  private addReviewRuleReason(
    reasons: SmartCashierReviewReason[],
    rule: {
      id: string;
      scope: SmartCashierRuleScope;
      menuItemId: string | null;
      categoryId: string | null;
      reasonCode: ManualReviewReasonCode;
      note: string | null;
    },
    details: Record<string, unknown> = {},
  ) {
    this.addReason(
      reasons,
      rule.reasonCode,
      'Smart cashier review rule requires cashier review.',
      {
        ruleId: rule.id,
        scope: rule.scope,
        menuItemId: rule.menuItemId,
        categoryId: rule.categoryId,
        note: rule.note,
        ...details,
      },
    );
  }

  private addReason(
    reasons: SmartCashierReviewReason[],
    code: ManualReviewReasonCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    reasons.push({
      code,
      message,
      ...(details ? { details } : {}),
    });
  }

  private uniqueValues(values: string[]) {
    return [...new Set(values)];
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private hasOwn(value: object, key: string) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }
}
