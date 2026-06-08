import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ExperienceProfileScope,
  ExperienceProfileStatus,
  MenuCategoryStatus,
  MenuItemStatus,
  ModifierGroupStatus,
  ModifierOptionStatus,
  OrderStatus,
  TableSessionStatus,
} from "@prisma/client";
import { CartService } from "../cart/cart.service";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiWaiterContext } from "./ai-waiter.types";

const MAX_OPERATIONAL_CART_ITEMS = 6;
const MAX_OPERATIONAL_RECENT_ORDERS = 5;
const MAX_OPERATIONAL_ACTIVE_WAITER_CALLS = 3;
const MAX_OPERATIONAL_ATTENTION_ITEMS = 5;
const ACTIVE_ORDER_STATUSES = new Set<string>([
  OrderStatus.submitted,
  OrderStatus.cashier_accepted,
  OrderStatus.preparing,
  OrderStatus.ready,
  OrderStatus.served,
]);
const BILLABLE_ORDER_STATUSES = [
  OrderStatus.cashier_accepted,
  OrderStatus.preparing,
  OrderStatus.ready,
  OrderStatus.served,
  OrderStatus.completed,
];
const ACTIVE_BILL_REQUEST_STATUSES = ["open", "acknowledged", "presented"];
const ACTIVE_WAITER_CALL_STATUSES = ["open", "acknowledged"];

@Injectable()
export class AiWaiterContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly configService: ConfigService,
    private readonly inventoryService: InventoryService,
  ) {}

  async findTableSessionOrThrow(sessionId: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: this.tableSessionSelect(),
    });

    if (!session) {
      throw new NotFoundException("Table session not found");
    }

    return session;
  }

  async findOpenTableSessionOrThrow(sessionId: string) {
    const session = await this.findTableSessionOrThrow(sessionId);

    if (
      session.status === TableSessionStatus.closed ||
      session.status === TableSessionStatus.expired ||
      (session.expiresAt && session.expiresAt <= new Date())
    ) {
      throw new BadRequestException(
        "AI waiter cannot be used for closed or expired sessions",
      );
    }

    return session;
  }

  async buildContext(
    tableSession: Awaited<
      ReturnType<AiWaiterContextService["findTableSessionOrThrow"]>
    >,
    aiWaiterSessionId?: string,
  ): Promise<AiWaiterContext> {
    const [effectiveExperience, menuItems, recentMessages, cartSummary] =
      await Promise.all([
        this.getEffectiveExperience(
          tableSession.companyId,
          tableSession.branchId,
        ),
        this.getMenuSnapshot(tableSession.companyId, tableSession.branchId),
        this.getRecentMessages(aiWaiterSessionId),
        this.cartService.getCart(tableSession.id),
      ]);
    const { branch, ...sessionFields } = tableSession;
    const operationalContext = await this.getOperationalContext(
      tableSession,
      cartSummary,
    );

    return {
      tableSession: sessionFields,
      branch,
      effectiveExperience,
      cartSummary,
      recentMessages,
      menuItems,
      operationalContext,
    };
  }

  async getEffectiveExperience(companyId: string, branchId: string) {
    const select = {
      id: true,
      key: true,
      name: true,
      language: true,
      brandVoice: true,
      aiWaiterTone: true,
    };
    const branchProfile = await this.prisma.experienceProfile.findFirst({
      where: {
        companyId,
        branchId,
        scope: ExperienceProfileScope.branch,
        status: ExperienceProfileStatus.active,
        isDefault: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select,
    });
    const profile =
      branchProfile ??
      (await this.prisma.experienceProfile.findFirst({
        where: {
          companyId,
          branchId: null,
          scope: ExperienceProfileScope.company,
          status: ExperienceProfileStatus.active,
          isDefault: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select,
      }));

    if (!profile) {
      return {};
    }

    return {
      profileId: profile.id,
      key: profile.key,
      name: profile.name,
      language: profile.language,
      brandVoice: profile.brandVoice,
      aiWaiterTone: profile.aiWaiterTone,
    };
  }

  private async getMenuSnapshot(companyId: string, branchId: string) {
    const menuSnapshotLimit = this.menuSnapshotLimit();
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        companyId,
        status: MenuItemStatus.active,
        category: { status: MenuCategoryStatus.active },
        branchOverrides: {
          some: {
            branchId,
            isAvailable: true,
            isVisible: true,
          },
        },
      },
      orderBy: [
        { isFeatured: "desc" },
        { sortOrder: "asc" },
        { name: "asc" },
        { id: "asc" },
      ],
      take: menuSnapshotLimit,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        currency: true,
        isFeatured: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
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
                  where: { status: ModifierOptionStatus.active },
                  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                  select: {
                    id: true,
                    groupId: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const availability = await this.inventoryService.getBranchMenuAvailability(
      branchId,
    );
    const availableMenuItemIds = new Set(
      availability.items
        .filter((item) => item.canOrder)
        .map((item) => item.menuItemId),
    );

    return menuItems.filter((item) => availableMenuItemIds.has(item.id)).map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      currency: item.currency,
      isFeatured: item.isFeatured,
      category: item.category,
      modifierGroups: item.modifierGroups
        .map((join) => join.modifierGroup)
        .filter((group) => group.status === ModifierGroupStatus.active)
        .map((group) => ({
          id: group.id,
          name: group.name,
          slug: group.slug,
          selectionType: group.selectionType,
          isRequired: group.isRequired,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          options: group.options,
        })),
    }));
  }

  private async getRecentMessages(aiWaiterSessionId?: string) {
    if (!aiWaiterSessionId) {
      return [];
    }

    const messages = await this.prisma.aiWaiterMessage.findMany({
      where: { aiWaiterSessionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 12,
      select: {
        role: true,
        kind: true,
        content: true,
        createdAt: true,
        metadata: true,
      },
    });

    return messages.reverse().map((message) => ({
      role: message.role,
      kind: message.kind,
      content: message.content,
      createdAt: message.createdAt,
      metadata: this.compactRecentMetadata(message.metadata),
    }));
  }

  private compactRecentMetadata(value: unknown) {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const metadata: Record<string, unknown> = {};
    const copiedKeys = [
      "provider",
      "mode",
      "groundingMode",
      "itemDetailGroundingMode",
      "itemDetailMenuItemId",
      "actionRejected",
      "fallbackUsed",
      "safetyFlags",
      "pendingModifierGroupId",
      "selectedModifierOptionIds",
    ];

    for (const key of copiedKeys) {
      const entry = value[key];

      if (
        typeof entry === "string" ||
        typeof entry === "boolean" ||
        (Array.isArray(entry) &&
          entry.every((item) => typeof item === "string"))
      ) {
        metadata[key] = entry;
      }
    }

    const pendingModifier = this.compactPendingModifier(
      value.pendingModifier,
    );

    if (pendingModifier) {
      metadata.mode = "modifier_question";
      metadata.pendingModifier = pendingModifier;
    }

    const pendingItem = this.compactPendingItem(value.pendingItem);

    if (pendingItem) {
      metadata.pendingItem = pendingItem;
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private compactPendingModifier(value: unknown) {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const allowedOptions = Array.isArray(value.allowedOptions)
      ? value.allowedOptions
          .filter((option): option is Record<string, unknown> =>
            this.isRecord(option),
          )
          .slice(0, 8)
          .map((option) => ({
            id: this.stringValue(option.id),
            name: this.stringValue(option.name),
            slug: this.stringValue(option.slug),
          }))
          .filter((option) => option.id && option.name)
      : [];
    const menuItemId = this.stringValue(value.menuItemId);
    const modifierGroupId = this.stringValue(value.modifierGroupId);
    const question = this.stringValue(value.question);

    if (!menuItemId || !modifierGroupId || allowedOptions.length === 0) {
      return undefined;
    }

    return {
      menuItemId,
      modifierGroupId,
      allowedOptionIds: allowedOptions.map((option) => option.id),
      allowedOptions,
      selectedModifierOptionIds: this.stringArray(value.selectedModifierOptionIds),
      question,
      createdAt: this.stringValue(value.createdAt),
    };
  }

  private compactPendingItem(value: unknown) {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const id = this.stringValue(value.id);
    const name = this.stringValue(value.name);

    return id && name ? { id, name } : undefined;
  }

  private async getOperationalContext(
    tableSession: Awaited<
      ReturnType<AiWaiterContextService["findTableSessionOrThrow"]>
    >,
    cartSummary: unknown,
  ): Promise<AiWaiterContext["operationalContext"]> {
    const [orders, bill, waiterCalls, attention, branchOps] =
      await Promise.all([
        this.getOrderContext(tableSession.id),
        this.getBillContext(tableSession.id),
        this.getWaiterCallContext(tableSession.id),
        this.getAttentionContext(tableSession.id),
        this.getBranchOpsContext(tableSession.branchId),
      ]);
    const startedAt = tableSession.startedAt ?? tableSession.createdAt;
    const sessionAgeMinutes = startedAt
      ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60_000))
      : undefined;

    return {
      generatedAt: new Date().toISOString(),
      sessionAgeMinutes,
      table: tableSession.table
        ? {
            id: tableSession.table.id,
            label:
              tableSession.table.displayName ??
              tableSession.table.code ??
              tableSession.table.id,
            status: tableSession.table.status,
            capacity: tableSession.table.capacity,
            floor: tableSession.table.floor
              ? {
                  id: tableSession.table.floor.id,
                  name: tableSession.table.floor.name,
                }
              : null,
          }
        : undefined,
      cart: this.compactCartContext(cartSummary),
      orders,
      bill,
      waiterCalls,
      attention,
      branchOps,
    };
  }

  private async getOrderContext(tableSessionId: string) {
    const prisma = this.prisma as unknown as {
      order?: {
        findMany?: (args: unknown) => Promise<any[]>;
        count?: (args: unknown) => Promise<number>;
      };
    };

    if (!prisma.order?.findMany) {
      return { activeCount: 0, recent: [] };
    }

    const [orders, activeCount] = await Promise.all([
      prisma.order.findMany({
        where: { tableSessionId },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: MAX_OPERATIONAL_RECENT_ORDERS,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          submittedAt: true,
          cashierAcceptedAt: true,
          readyAt: true,
          servedAt: true,
          completedAt: true,
          itemCount: true,
          preparationTasks: {
            select: {
              status: true,
              station: true,
            },
          },
        },
      }),
      prisma.order.count
        ? prisma.order.count({
            where: {
              tableSessionId,
              status: { in: Array.from(ACTIVE_ORDER_STATUSES) },
            },
          })
        : Promise.resolve(0),
    ]);
    const latest = orders[0];

    return {
      activeCount:
        activeCount ||
        orders.filter((order) => ACTIVE_ORDER_STATUSES.has(String(order.status)))
          .length,
      latest: latest
        ? {
            id: latest.id,
            orderNumber: latest.orderNumber,
            status: String(latest.status),
            customerStatus: this.customerOrderStatus(latest.status),
            submittedAt: this.isoString(latest.submittedAt),
            acceptedAt: this.isoString(latest.cashierAcceptedAt),
            readyAt: this.isoString(latest.readyAt),
            servedAt: this.isoString(latest.servedAt),
            completedAt: this.isoString(latest.completedAt),
            itemCount: this.numberValue(latest.itemCount, 0),
            preparationSummary: this.preparationSummary(
              latest.preparationTasks,
            ),
          }
        : undefined,
      recent: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: String(order.status),
        customerStatus: this.customerOrderStatus(order.status),
        itemCount: this.numberValue(order.itemCount, 0),
        submittedAt: this.isoString(order.submittedAt),
      })),
    };
  }

  private async getBillContext(tableSessionId: string) {
    const prisma = this.prisma as unknown as {
      billRequest?: { findFirst?: (args: unknown) => Promise<any> };
      bill?: { findFirst?: (args: unknown) => Promise<any> };
      order?: { count?: (args: unknown) => Promise<number> };
    };
    const [activeBillRequest, latestBill, billableOrderCount] =
      await Promise.all([
        prisma.billRequest?.findFirst
          ? prisma.billRequest.findFirst({
              where: {
                tableSessionId,
                status: { in: ACTIVE_BILL_REQUEST_STATUSES },
              },
              orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
              select: {
                id: true,
                status: true,
              },
            })
          : Promise.resolve(null),
        prisma.bill?.findFirst
          ? prisma.bill.findFirst({
              where: {
                tableSessionId,
                status: { not: "cancelled" },
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                receipt: { select: { id: true } },
              },
            })
          : Promise.resolve(null),
        prisma.order?.count
          ? prisma.order.count({
              where: {
                tableSessionId,
                status: { in: BILLABLE_ORDER_STATUSES },
              },
            })
          : Promise.resolve(0),
      ]);

    return {
      activeBillRequestId: activeBillRequest?.id ?? null,
      activeBillRequestStatus: activeBillRequest
        ? String(activeBillRequest.status)
        : null,
      hasBillableOrders: billableOrderCount > 0,
      billStatus: latestBill ? String(latestBill.status) : null,
      paymentStatus: this.paymentStatus(latestBill?.status),
      receiptAvailable: Boolean(latestBill?.receipt),
    };
  }

  private async getWaiterCallContext(tableSessionId: string) {
    const prisma = this.prisma as unknown as {
      waiterCall?: {
        findMany?: (args: unknown) => Promise<any[]>;
        count?: (args: unknown) => Promise<number>;
      };
    };

    if (!prisma.waiterCall?.findMany) {
      return { activeCount: 0 };
    }

    const [activeCalls, activeCount] = await Promise.all([
      prisma.waiterCall.findMany({
        where: {
          tableSessionId,
          status: { in: ACTIVE_WAITER_CALL_STATUSES },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: MAX_OPERATIONAL_ACTIVE_WAITER_CALLS,
        select: {
          id: true,
          type: true,
          status: true,
          priority: true,
          createdAt: true,
          message: true,
        },
      }),
      prisma.waiterCall.count
        ? prisma.waiterCall.count({
            where: {
              tableSessionId,
              status: { in: ACTIVE_WAITER_CALL_STATUSES },
            },
          })
        : Promise.resolve(0),
    ]);
    const latest = activeCalls[0];

    return {
      activeCount: activeCount || activeCalls.length,
      latest: latest
        ? {
            id: latest.id,
            type: String(latest.type),
            status: String(latest.status),
            priority: this.numberValue(latest.priority, 0),
            createdAt: this.isoString(latest.createdAt) ?? "",
            message: latest.message ?? null,
          }
        : undefined,
    };
  }

  private async getAttentionContext(tableSessionId: string) {
    const prisma = this.prisma as unknown as {
      tableAttentionSnapshot?: { findUnique?: (args: unknown) => Promise<any> };
    };

    if (!prisma.tableAttentionSnapshot?.findUnique) {
      return undefined;
    }

    const snapshot = await prisma.tableAttentionSnapshot.findUnique({
      where: { tableSessionId },
      select: {
        status: true,
        priority: true,
        score: true,
        reasons: true,
        recommendedActions: true,
      },
    });

    if (!snapshot) {
      return undefined;
    }

    return {
      status: String(snapshot.status),
      priority: String(snapshot.priority),
      score: this.numberValue(snapshot.score, 0),
      reasons: this.safeStringArray(snapshot.reasons).slice(
        0,
        MAX_OPERATIONAL_ATTENTION_ITEMS,
      ),
      recommendedActions: this.safeStringArray(
        snapshot.recommendedActions,
      ).slice(0, MAX_OPERATIONAL_ATTENTION_ITEMS),
    };
  }

  private async getBranchOpsContext(branchId: string) {
    const prisma = this.prisma as unknown as {
      branchOperatingSettings?: { findUnique?: (args: unknown) => Promise<any> };
      branchFeatureFlag?: { findMany?: (args: unknown) => Promise<any[]> };
    };
    const [settings, flags] = await Promise.all([
      prisma.branchOperatingSettings?.findUnique
        ? prisma.branchOperatingSettings.findUnique({
            where: { branchId },
            select: {
              operatingMode: true,
              serviceMode: true,
              aiWaiterEnabled: true,
              waiterCallsEnabled: true,
              billFlowEnabled: true,
              tableAttentionEnabled: true,
            },
          })
        : Promise.resolve(null),
      prisma.branchFeatureFlag?.findMany
        ? prisma.branchFeatureFlag.findMany({
            where: {
              branchId,
              key: {
                in: [
                  "ai_waiter",
                  "waiter_calls",
                  "bill_flow",
                  "table_attention",
                ],
              },
            },
            select: { key: true, enabled: true },
          })
        : Promise.resolve([]),
    ]);
    const flagMap = new Map(
      flags.map((flag) => [String(flag.key), flag.enabled === true]),
    );

    return {
      operatingMode: settings ? String(settings.operatingMode) : undefined,
      serviceMode: settings ? String(settings.serviceMode) : undefined,
      aiWaiterEnabled: this.enabledFlag(
        flagMap,
        "ai_waiter",
        settings?.aiWaiterEnabled,
      ),
      waiterCallsEnabled: this.enabledFlag(
        flagMap,
        "waiter_calls",
        settings?.waiterCallsEnabled,
      ),
      billFlowEnabled: this.enabledFlag(
        flagMap,
        "bill_flow",
        settings?.billFlowEnabled,
      ),
      tableAttentionEnabled: this.enabledFlag(
        flagMap,
        "table_attention",
        settings?.tableAttentionEnabled,
      ),
    };
  }

  private compactCartContext(cartSummary: unknown) {
    const record = this.isRecord(cartSummary) ? cartSummary : {};
    const totals = this.isRecord(record.totals) ? record.totals : {};
    const cart = this.isRecord(record.cart) ? record.cart : {};
    const items = this.recordArray(record.items);
    const itemCount = this.numberValue(totals.itemCount, items.length);
    const totalQuantity = this.numberValue(
      totals.totalQuantity,
      items.reduce(
        (sum, item) => sum + this.numberValue(item.quantity, 0),
        0,
      ),
    );

    return {
      itemCount,
      totalQuantity,
      hasOpenCart:
        totalQuantity > 0 &&
        (this.stringValue(cart.status) === "draft" ||
          this.stringValue(cart.status) === ""),
      items: items.slice(0, MAX_OPERATIONAL_CART_ITEMS).map((item, index) => {
        const modifierLabels = this.recordArray(item.modifierOptions)
          .map(
            (option) =>
              this.stringValue(option.modifierOptionNameSnapshot) ||
              this.stringValue(option.name),
          )
          .filter((value) => value.length > 0)
          .slice(0, 8);
        const menuItemId = this.stringValue(item.menuItemId);
        const name =
          this.stringValue(item.itemNameSnapshot) ||
          this.stringValue(item.name) ||
          "Menu item";

        return {
          id: this.stringValue(item.id) || `${menuItemId || "item"}-${index}`,
          menuItemId,
          name,
          quantity: this.numberValue(item.quantity, 1),
          notes: this.stringValue(item.notes) || null,
          modifierLabels,
        };
      }),
    };
  }

  private preparationSummary(tasks: unknown) {
    const records = this.recordArray(tasks);

    if (records.length === 0) {
      return undefined;
    }

    const summary = {
      pending: 0,
      preparing: 0,
      ready: 0,
      cancelled: 0,
      stations: [] as string[],
    };
    const stations = new Set<string>();

    for (const task of records) {
      const status = this.stringValue(task.status);

      if (status === "pending") {
        summary.pending += 1;
      } else if (status === "preparing") {
        summary.preparing += 1;
      } else if (status === "ready") {
        summary.ready += 1;
      } else if (status === "cancelled") {
        summary.cancelled += 1;
      }

      const station = this.stringValue(task.station);

      if (station) {
        stations.add(station);
      }
    }

    summary.stations = Array.from(stations).slice(0, 5);

    return summary;
  }

  private customerOrderStatus(status: unknown) {
    switch (status) {
      case OrderStatus.submitted:
        return "submitted";
      case OrderStatus.cashier_accepted:
      case OrderStatus.preparing:
        return "preparing";
      case OrderStatus.ready:
        return "ready";
      case OrderStatus.served:
        return "served";
      case OrderStatus.completed:
        return "completed";
      case OrderStatus.cashier_rejected:
        return "rejected";
      case OrderStatus.cancelled:
        return "cancelled";
      default:
        return undefined;
    }
  }

  private paymentStatus(status: unknown) {
    if (status === "paid") {
      return "paid";
    }

    if (status === "payment_pending") {
      return "payment_pending";
    }

    return undefined;
  }

  private enabledFlag(
    flags: Map<string, boolean>,
    key: string,
    settingsValue?: boolean,
  ) {
    return flags.get(key) ?? settingsValue ?? true;
  }

  private tableSessionSelect() {
    return {
      id: true,
      companyId: true,
      branchId: true,
      tableId: true,
      status: true,
      guestLabel: true,
      partySize: true,
      startedAt: true,
      expiresAt: true,
      createdAt: true,
      table: {
        select: {
          id: true,
          code: true,
          displayName: true,
          status: true,
          capacity: true,
          floor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      branch: {
        select: {
          id: true,
          companyId: true,
          name: true,
          slug: true,
        },
      },
    };
  }

  private menuSnapshotLimit() {
    const value = this.configService.get<number | string>(
      "aiWaiter.menuSnapshotLimit",
    );
    const parsed = typeof value === "number" ? value : Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 200;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private stringValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  private numberValue(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : fallback;
  }

  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  private safeStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }

  private recordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> =>
          this.isRecord(item),
        )
      : [];
  }

  private isoString(value: unknown) {
    return value instanceof Date ? value.toISOString() : null;
  }
}
