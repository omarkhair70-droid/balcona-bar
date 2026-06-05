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
  TableSessionStatus,
} from "@prisma/client";
import { CartService } from "../cart/cart.service";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiWaiterContext } from "./ai-waiter.types";

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

    return {
      tableSession: sessionFields,
      branch,
      effectiveExperience,
      cartSummary,
      recentMessages,
      menuItems,
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

  private tableSessionSelect() {
    return {
      id: true,
      companyId: true,
      branchId: true,
      tableId: true,
      status: true,
      guestLabel: true,
      partySize: true,
      expiresAt: true,
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

  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }
}
