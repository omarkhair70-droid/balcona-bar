import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
import { PrismaService } from "../prisma/prisma.service";
import { AiWaiterContext } from "./ai-waiter.types";

@Injectable()
export class AiWaiterContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
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
      take: 60,
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

    return menuItems.map((item) => ({
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
      },
    });

    return messages.reverse();
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
}
