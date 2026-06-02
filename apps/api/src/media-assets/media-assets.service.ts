import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaAssetStatus,
  MediaAssetUsageTarget,
  MediaStorageProvider,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMediaAssetDto,
  CreateMediaUsageDto,
  ListMediaAssetsQueryDto,
  ListMediaUsagesQueryDto,
  UpdateMediaAssetDto,
  UpdateMediaUsageDto,
} from './dto/media-asset.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const branchSummarySelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  status: true,
} satisfies Prisma.BranchSelect;

const mediaAssetSelect = {
  id: true,
  companyId: true,
  branchId: true,
  type: true,
  status: true,
  provider: true,
  storageKey: true,
  publicUrl: true,
  originalUrl: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  durationSeconds: true,
  title: true,
  altText: true,
  caption: true,
  dominantColor: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  branch: {
    select: branchSummarySelect,
  },
} satisfies Prisma.MediaAssetSelect;

const mediaUsageSelect = {
  id: true,
  companyId: true,
  branchId: true,
  mediaAssetId: true,
  target: true,
  targetId: true,
  role: true,
  sortOrder: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  branch: {
    select: branchSummarySelect,
  },
  mediaAsset: {
    select: mediaAssetSelect,
  },
} satisfies Prisma.MediaAssetUsageSelect;

type MediaAssetRecord = Prisma.MediaAssetGetPayload<{
  select: typeof mediaAssetSelect;
}>;

type TargetOwnership = {
  companyId: string;
  branchId?: string | null;
};

@Injectable()
export class MediaAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAssets(companyId: string, query: ListMediaAssetsQueryDto) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const where: Prisma.MediaAssetWhereInput = { companyId };
    const search = this.normalizeSearch(query.search);

    if (query.branchId) {
      await this.assertBranchBelongsToCompany(
        query.branchId,
        companyId,
        this.prisma,
      );
      where.branchId = query.branchId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.provider) {
      where.provider = query.provider;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { altText: { contains: search, mode: 'insensitive' } },
        { caption: { contains: search, mode: 'insensitive' } },
        { publicUrl: { contains: search, mode: 'insensitive' } },
        { originalUrl: { contains: search, mode: 'insensitive' } },
      ];
    }

    const mediaAssets = await this.prisma.mediaAsset.findMany({
      where,
      take: this.limit(query.limit),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: mediaAssetSelect,
    });

    return { company, mediaAssets };
  }

  async createAsset(companyId: string, body: CreateMediaAssetDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await this.findCompanyOrThrow(companyId, tx);
      const branchId = await this.normalizeBranchId(
        body.branchId,
        company.id,
        tx,
      );
      const provider = body.provider ?? MediaStorageProvider.external_url;
      this.assertExternalUrls(provider, body.publicUrl, body.originalUrl);

      const mediaAsset = await tx.mediaAsset.create({
        data: {
          companyId: company.id,
          branchId,
          type: body.type,
          provider,
          storageKey: this.normalizeOptionalText(body.storageKey),
          publicUrl: this.normalizeOptionalText(body.publicUrl),
          originalUrl: this.normalizeOptionalText(body.originalUrl),
          mimeType: this.normalizeOptionalText(body.mimeType),
          sizeBytes: body.sizeBytes ?? null,
          width: body.width ?? null,
          height: body.height ?? null,
          durationSeconds: body.durationSeconds ?? null,
          title: this.normalizeOptionalText(body.title),
          altText: this.normalizeOptionalText(body.altText),
          caption: this.normalizeOptionalText(body.caption),
          dominantColor: this.normalizeOptionalText(body.dominantColor),
          metadata: this.toNullableJson(body.metadata),
        },
        select: mediaAssetSelect,
      });

      return { company, mediaAsset };
    });
  }

  async getAsset(mediaAssetId: string) {
    const mediaAsset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaAssetId },
      select: {
        ...mediaAssetSelect,
        usages: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: mediaUsageSelect,
        },
      },
    });

    if (!mediaAsset) {
      throw new NotFoundException('Media asset not found');
    }

    return { mediaAsset };
  }

  async updateAsset(mediaAssetId: string, body: UpdateMediaAssetDto) {
    return this.prisma.$transaction(async (tx) => {
      const existingAsset = await this.findAssetOrThrow(mediaAssetId, tx);
      const provider = body.provider ?? existingAsset.provider;
      this.assertExternalUrls(
        provider,
        body.publicUrl ?? existingAsset.publicUrl,
        body.originalUrl ?? existingAsset.originalUrl,
      );
      const data: Prisma.MediaAssetUpdateInput = {};

      if (this.hasOwn(body, 'branchId')) {
        if (body.branchId) {
          const branchId = await this.normalizeBranchId(
            body.branchId,
            existingAsset.companyId,
            tx,
          );

          if (!branchId) {
            throw new BadRequestException('Branch is required');
          }

          data.branch = { connect: { id: branchId } };
        } else {
          data.branch = { disconnect: true };
        }
      }

      if (body.type !== undefined) {
        data.type = body.type;
      }

      if (body.status !== undefined) {
        data.status = body.status;
      }

      if (body.provider !== undefined) {
        data.provider = body.provider;
      }

      this.assignOptionalText(data, body, 'storageKey');
      this.assignOptionalText(data, body, 'publicUrl');
      this.assignOptionalText(data, body, 'originalUrl');
      this.assignOptionalText(data, body, 'mimeType');
      this.assignOptionalText(data, body, 'title');
      this.assignOptionalText(data, body, 'altText');
      this.assignOptionalText(data, body, 'caption');
      this.assignOptionalText(data, body, 'dominantColor');
      this.assignNullableNumber(data, body, 'sizeBytes');
      this.assignNullableNumber(data, body, 'width');
      this.assignNullableNumber(data, body, 'height');
      this.assignNullableNumber(data, body, 'durationSeconds');

      if (this.hasOwn(body, 'metadata')) {
        data.metadata = this.toNullableJson(body.metadata);
      }

      const mediaAsset = await tx.mediaAsset.update({
        where: { id: existingAsset.id },
        data,
        select: mediaAssetSelect,
      });

      return { mediaAsset };
    });
  }

  archiveAsset(mediaAssetId: string) {
    return this.updateAssetStatus(mediaAssetId, MediaAssetStatus.archived);
  }

  restoreAsset(mediaAssetId: string) {
    return this.updateAssetStatus(mediaAssetId, MediaAssetStatus.active);
  }

  markAssetDeleted(mediaAssetId: string) {
    return this.updateAssetStatus(mediaAssetId, MediaAssetStatus.deleted);
  }

  async listUsages(query: ListMediaUsagesQueryDto) {
    if (!query.companyId && !(query.target && query.targetId)) {
      throw new BadRequestException(
        'companyId or both target and targetId are required',
      );
    }

    const where: Prisma.MediaAssetUsageWhereInput = {};

    if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.target) {
      where.target = query.target;
    }

    if (query.targetId) {
      where.targetId = query.targetId;
    }

    if (query.role) {
      where.role = query.role.trim();
    }

    const usages = await this.prisma.mediaAssetUsage.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: mediaUsageSelect,
    });

    return { usages };
  }

  async createUsage(mediaAssetId: string, body: CreateMediaUsageDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const mediaAsset = await this.findAssetOrThrow(mediaAssetId, tx);
        const ownership = await this.resolveTargetOwnership(
          mediaAsset.companyId,
          body.target,
          body.targetId,
          tx,
        );
        const branchId = await this.resolveUsageBranchId(
          body.branchId,
          mediaAsset,
          ownership,
          tx,
        );
        const usage = await tx.mediaAssetUsage.create({
          data: {
            companyId: mediaAsset.companyId,
            branchId,
            mediaAssetId: mediaAsset.id,
            target: body.target,
            targetId: body.targetId,
            role: this.normalizeRole(body.role),
            sortOrder: body.sortOrder ?? 0,
            metadata: this.toNullableJson(body.metadata),
          },
          select: mediaUsageSelect,
        });

        return { mediaAsset, usage };
      });
    } catch (error) {
      this.handleKnownWriteError(error, 'Media usage already exists');
    }
  }

  async updateUsage(usageId: string, body: UpdateMediaUsageDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingUsage = await tx.mediaAssetUsage.findUnique({
          where: { id: usageId },
          select: mediaUsageSelect,
        });

        if (!existingUsage) {
          throw new NotFoundException('Media usage not found');
        }

        const target = body.target ?? existingUsage.target;
        const targetId = body.targetId ?? existingUsage.targetId;
        const ownership = await this.resolveTargetOwnership(
          existingUsage.companyId,
          target,
          targetId,
          tx,
        );
        const branchId = this.hasOwn(body, 'branchId')
          ? await this.resolveUsageBranchId(
              body.branchId,
              existingUsage.mediaAsset,
              ownership,
              tx,
            )
          : existingUsage.branchId;
        const data: Prisma.MediaAssetUsageUpdateInput = {
          target,
          targetId,
          branch: branchId
            ? { connect: { id: branchId } }
            : existingUsage.branchId
              ? { disconnect: true }
              : undefined,
        };

        if (body.role !== undefined) {
          data.role = this.normalizeRole(body.role);
        }

        if (body.sortOrder !== undefined) {
          data.sortOrder = body.sortOrder;
        }

        if (this.hasOwn(body, 'metadata')) {
          data.metadata = this.toNullableJson(body.metadata);
        }

        const usage = await tx.mediaAssetUsage.update({
          where: { id: existingUsage.id },
          data,
          select: mediaUsageSelect,
        });

        return { usage };
      });
    } catch (error) {
      this.handleKnownWriteError(error, 'Media usage already exists');
    }
  }

  async deleteUsage(usageId: string) {
    const existingUsage = await this.prisma.mediaAssetUsage.findUnique({
      where: { id: usageId },
      select: { id: true },
    });

    if (!existingUsage) {
      throw new NotFoundException('Media usage not found');
    }

    const usage = await this.prisma.mediaAssetUsage.delete({
      where: { id: existingUsage.id },
      select: mediaUsageSelect,
    });

    return { deleted: true, usage };
  }

  private async updateAssetStatus(
    mediaAssetId: string,
    status: MediaAssetStatus,
  ) {
    await this.findAssetOrThrow(mediaAssetId, this.prisma);
    const mediaAsset = await this.prisma.mediaAsset.update({
      where: { id: mediaAssetId },
      data: { status },
      select: mediaAssetSelect,
    });

    return { mediaAsset };
  }

  private async findCompanyOrThrow(companyId: string, tx: PrismaExecutor) {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  private async findAssetOrThrow(
    mediaAssetId: string,
    tx: PrismaExecutor,
  ): Promise<MediaAssetRecord> {
    const mediaAsset = await tx.mediaAsset.findUnique({
      where: { id: mediaAssetId },
      select: mediaAssetSelect,
    });

    if (!mediaAsset) {
      throw new NotFoundException('Media asset not found');
    }

    return mediaAsset;
  }

  private async normalizeBranchId(
    branchId: string | null | undefined,
    companyId: string,
    tx: PrismaExecutor,
  ) {
    if (!branchId) {
      return null;
    }

    await this.assertBranchBelongsToCompany(branchId, companyId, tx);

    return branchId;
  }

  private async assertBranchBelongsToCompany(
    branchId: string,
    companyId: string,
    tx: PrismaExecutor,
  ) {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: { id: true, companyId: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.companyId !== companyId) {
      throw new BadRequestException('Branch does not belong to company');
    }
  }

  private async resolveUsageBranchId(
    requestedBranchId: string | null | undefined,
    mediaAsset: Pick<MediaAssetRecord, 'companyId' | 'branchId'>,
    ownership: TargetOwnership,
    tx: PrismaExecutor,
  ) {
    const branchId =
      requestedBranchId ?? ownership.branchId ?? mediaAsset.branchId;

    if (!branchId) {
      return null;
    }

    await this.assertBranchBelongsToCompany(branchId, mediaAsset.companyId, tx);

    return branchId;
  }

  private async resolveTargetOwnership(
    expectedCompanyId: string,
    target: MediaAssetUsageTarget,
    targetId: string,
    tx: PrismaExecutor,
  ): Promise<TargetOwnership> {
    switch (target) {
      case MediaAssetUsageTarget.company: {
        await this.findCompanyOrThrow(targetId, tx);
        this.assertSameCompany(targetId, expectedCompanyId, 'Target company');
        return { companyId: targetId };
      }
      case MediaAssetUsageTarget.branch: {
        const branch = await tx.branch.findUnique({
          where: { id: targetId },
          select: { id: true, companyId: true },
        });
        this.assertFound(branch, 'Branch not found');
        this.assertSameCompany(
          branch.companyId,
          expectedCompanyId,
          'Target branch',
        );
        return { companyId: branch.companyId, branchId: branch.id };
      }
      case MediaAssetUsageTarget.menu_category: {
        const category = await tx.menuCategory.findUnique({
          where: { id: targetId },
          select: { id: true, companyId: true },
        });
        this.assertFound(category, 'Menu category not found');
        this.assertSameCompany(
          category.companyId,
          expectedCompanyId,
          'Target category',
        );
        return { companyId: category.companyId };
      }
      case MediaAssetUsageTarget.menu_item: {
        const item = await tx.menuItem.findUnique({
          where: { id: targetId },
          select: { id: true, companyId: true },
        });
        this.assertFound(item, 'Menu item not found');
        this.assertSameCompany(
          item.companyId,
          expectedCompanyId,
          'Target item',
        );
        return { companyId: item.companyId };
      }
      case MediaAssetUsageTarget.modifier_group: {
        const group = await tx.modifierGroup.findUnique({
          where: { id: targetId },
          select: { id: true, companyId: true },
        });
        this.assertFound(group, 'Modifier group not found');
        this.assertSameCompany(
          group.companyId,
          expectedCompanyId,
          'Target modifier group',
        );
        return { companyId: group.companyId };
      }
      case MediaAssetUsageTarget.venue_zone: {
        const zone = await tx.venueZone.findUnique({
          where: { id: targetId },
          select: { id: true, companyId: true, branchId: true },
        });
        this.assertFound(zone, 'Venue zone not found');
        this.assertSameCompany(
          zone.companyId,
          expectedCompanyId,
          'Target venue zone',
        );
        return { companyId: zone.companyId, branchId: zone.branchId };
      }
      case MediaAssetUsageTarget.experience_profile: {
        const profile = await tx.experienceProfile.findUnique({
          where: { id: targetId },
          select: { id: true, companyId: true, branchId: true },
        });
        this.assertFound(profile, 'Experience profile not found');
        this.assertSameCompany(
          profile.companyId,
          expectedCompanyId,
          'Target experience profile',
        );
        return { companyId: profile.companyId, branchId: profile.branchId };
      }
      case MediaAssetUsageTarget.content_block: {
        const block = await tx.contentBlock.findUnique({
          where: { id: targetId },
          select: { id: true, companyId: true, branchId: true },
        });
        this.assertFound(block, 'Content block not found');
        this.assertSameCompany(
          block.companyId,
          expectedCompanyId,
          'Target content block',
        );
        return { companyId: block.companyId, branchId: block.branchId };
      }
      case MediaAssetUsageTarget.notification_template: {
        const template = await tx.notificationTemplate.findUnique({
          where: { id: targetId },
          select: { id: true, companyId: true, branchId: true },
        });
        this.assertFound(template, 'Notification template not found');
        this.assertSameCompany(
          template.companyId,
          expectedCompanyId,
          'Target notification template',
        );
        return { companyId: template.companyId, branchId: template.branchId };
      }
      case MediaAssetUsageTarget.ai_waiter:
      case MediaAssetUsageTarget.other:
        return { companyId: expectedCompanyId };
      default:
        return { companyId: expectedCompanyId };
    }
  }

  private assertExternalUrls(
    provider: MediaStorageProvider,
    publicUrl?: string | null,
    originalUrl?: string | null,
  ) {
    if (
      provider === MediaStorageProvider.external_url &&
      !publicUrl &&
      !originalUrl
    ) {
      throw new BadRequestException(
        'external_url media assets require publicUrl or originalUrl',
      );
    }
  }

  private assignOptionalText(
    data: Prisma.MediaAssetUpdateInput,
    body: UpdateMediaAssetDto,
    key:
      | 'storageKey'
      | 'publicUrl'
      | 'originalUrl'
      | 'mimeType'
      | 'title'
      | 'altText'
      | 'caption'
      | 'dominantColor',
  ) {
    if (this.hasOwn(body, key)) {
      data[key] = this.normalizeOptionalText(body[key]);
    }
  }

  private assignNullableNumber(
    data: Prisma.MediaAssetUpdateInput,
    body: UpdateMediaAssetDto,
    key: 'sizeBytes' | 'width' | 'height' | 'durationSeconds',
  ) {
    if (this.hasOwn(body, key)) {
      data[key] = body[key] ?? null;
    }
  }

  private assertFound<TValue>(
    value: TValue | null,
    message: string,
  ): asserts value is TValue {
    if (!value) {
      throw new NotFoundException(message);
    }
  }

  private assertSameCompany(
    actualCompanyId: string,
    expectedCompanyId: string,
    label: string,
  ) {
    if (actualCompanyId !== expectedCompanyId) {
      throw new BadRequestException(
        `${label} does not belong to the media asset company`,
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

  private normalizeRole(value?: string) {
    const normalizedValue = value?.trim();

    return normalizedValue && normalizedValue.length > 0
      ? normalizedValue
      : 'default';
  }

  private limit(value?: number) {
    return value ?? 100;
  }

  private toNullableJson(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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
