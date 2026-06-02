import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentBlockStatus,
  ExperienceProfileScope,
  ExperienceProfileStatus,
  NotificationChannel,
  Prisma,
  VenueZoneStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BALKONA_PACK_KEY,
  BALKONA_PACK_LANGUAGE,
  balkonaAiWaiterTone,
  balkonaBrandVoice,
  balkonaContentBlocks,
  balkonaDesignTokens,
  balkonaLayoutConfig,
  balkonaMotionTokens,
  balkonaNotificationTemplates,
  balkonaTheme,
  balkonaVenueZones,
} from './balkona-pack';
import {
  CreateExperienceProfileDto,
  ListExperienceProfilesQueryDto,
  UpdateExperienceProfileDto,
} from './dto/experience-profile.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const companySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
} satisfies Prisma.CompanySelect;

const branchSelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  status: true,
} satisfies Prisma.BranchSelect;

const experienceProfileSelect = {
  id: true,
  companyId: true,
  branchId: true,
  scope: true,
  key: true,
  name: true,
  status: true,
  isDefault: true,
  language: true,
  theme: true,
  designTokens: true,
  motionTokens: true,
  layoutConfig: true,
  brandVoice: true,
  aiWaiterTone: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  branch: {
    select: branchSelect,
  },
} satisfies Prisma.ExperienceProfileSelect;

const contentBlockSelect = {
  id: true,
  companyId: true,
  branchId: true,
  experienceProfileId: true,
  placement: true,
  key: true,
  language: true,
  status: true,
  title: true,
  body: true,
  ctaLabel: true,
  ctaAction: true,
  sortOrder: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContentBlockSelect;

const notificationTemplateSelect = {
  id: true,
  companyId: true,
  branchId: true,
  key: true,
  kind: true,
  channel: true,
  language: true,
  title: true,
  body: true,
  isActive: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NotificationTemplateSelect;

const venueZoneSelect = {
  id: true,
  companyId: true,
  branchId: true,
  name: true,
  slug: true,
  type: true,
  status: true,
  description: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VenueZoneSelect;

type ExperienceProfileRecord = Prisma.ExperienceProfileGetPayload<{
  select: typeof experienceProfileSelect;
}>;

type ContentBlockRecord = Prisma.ContentBlockGetPayload<{
  select: typeof contentBlockSelect;
}>;

type NotificationTemplateRecord = Prisma.NotificationTemplateGetPayload<{
  select: typeof notificationTemplateSelect;
}>;

type VenueZoneRecord = Prisma.VenueZoneGetPayload<{
  select: typeof venueZoneSelect;
}>;

type ExperienceScope = {
  companyId: string;
  branchId: string | null;
  scope: ExperienceProfileScope;
};

@Injectable()
export class ExperienceService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanyProfiles(
    companyId: string,
    query: ListExperienceProfilesQueryDto,
  ) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const profiles = await this.listProfiles(
      {
        companyId: company.id,
        branchId: null,
        scope: ExperienceProfileScope.company,
      },
      query,
    );

    return { company, profiles };
  }

  async listBranchProfiles(
    branchId: string,
    query: ListExperienceProfilesQueryDto,
  ) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const profiles = await this.listProfiles(
      {
        companyId: branch.companyId,
        branchId: branch.id,
        scope: ExperienceProfileScope.branch,
      },
      query,
    );

    return { branch, profiles };
  }

  async createCompanyProfile(
    companyId: string,
    body: CreateExperienceProfileDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const company = await this.findCompanyOrThrow(companyId, tx);
      const profile = await this.createProfile(
        {
          companyId: company.id,
          branchId: null,
          scope: ExperienceProfileScope.company,
        },
        body,
        tx,
      );

      return { company, profile };
    });
  }

  async createBranchProfile(
    branchId: string,
    body: CreateExperienceProfileDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchOrThrow(branchId, tx);
      const profile = await this.createProfile(
        {
          companyId: branch.companyId,
          branchId: branch.id,
          scope: ExperienceProfileScope.branch,
        },
        body,
        tx,
      );

      return { branch, profile };
    });
  }

  async getProfile(experienceProfileId: string) {
    const profile = await this.prisma.experienceProfile.findUnique({
      where: { id: experienceProfileId },
      select: {
        ...experienceProfileSelect,
        contentBlocks: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: contentBlockSelect,
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Experience profile not found');
    }

    return { profile };
  }

  async updateProfile(
    experienceProfileId: string,
    body: UpdateExperienceProfileDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existingProfile = await this.findProfileOrThrow(
        experienceProfileId,
        tx,
      );
      const data: Prisma.ExperienceProfileUpdateInput = {};

      if (body.key !== undefined) {
        data.key = body.key.trim();
      }

      if (body.name !== undefined) {
        data.name = body.name.trim();
      }

      if (body.status !== undefined) {
        data.status = body.status;
      }

      if (body.isDefault !== undefined) {
        if (body.isDefault) {
          await this.clearDefaultProfiles(existingProfile, tx);
          data.status = ExperienceProfileStatus.active;
        }
        data.isDefault = body.isDefault;
      }

      if (body.language !== undefined) {
        data.language = this.normalizeLanguage(body.language);
      }

      this.assignJson(data, body, 'theme');
      this.assignJson(data, body, 'designTokens');
      this.assignJson(data, body, 'motionTokens');
      this.assignJson(data, body, 'layoutConfig');
      this.assignJson(data, body, 'brandVoice');
      this.assignJson(data, body, 'aiWaiterTone');
      this.assignJson(data, body, 'metadata');

      const profile = await tx.experienceProfile.update({
        where: { id: existingProfile.id },
        data,
        select: experienceProfileSelect,
      });

      return { profile };
    });
  }

  activateProfile(experienceProfileId: string) {
    return this.updateProfile(experienceProfileId, {
      status: ExperienceProfileStatus.active,
    });
  }

  archiveProfile(experienceProfileId: string) {
    return this.updateProfile(experienceProfileId, {
      status: ExperienceProfileStatus.archived,
      isDefault: false,
    });
  }

  async setDefaultProfile(experienceProfileId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existingProfile = await this.findProfileOrThrow(
        experienceProfileId,
        tx,
      );
      await this.clearDefaultProfiles(existingProfile, tx);
      const profile = await tx.experienceProfile.update({
        where: { id: existingProfile.id },
        data: {
          status: ExperienceProfileStatus.active,
          isDefault: true,
        },
        select: experienceProfileSelect,
      });

      return { profile };
    });
  }

  async getEffectiveBranchExperience(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const company = await this.findCompanyOrThrow(
      branch.companyId,
      this.prisma,
    );
    const profile = await this.findEffectiveProfile(branch);
    const contentBlocks = await this.prisma.contentBlock.findMany({
      where: {
        companyId: branch.companyId,
        status: ContentBlockStatus.active,
        OR: [
          { branchId: branch.id },
          { branchId: null },
          ...(profile ? [{ experienceProfileId: profile.id }] : []),
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: contentBlockSelect,
    });
    const venueZones = await this.prisma.venueZone.findMany({
      where: {
        branchId: branch.id,
        status: VenueZoneStatus.active,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: venueZoneSelect,
    });
    const mediaUsageWhere: Prisma.MediaAssetUsageWhereInput[] = [
      { target: 'branch', targetId: branch.id },
    ];

    if (profile) {
      mediaUsageWhere.push({
        target: 'experience_profile',
        targetId: profile.id,
      });
    }

    const mediaUsages = await this.prisma.mediaAssetUsage.findMany({
      where: {
        companyId: branch.companyId,
        OR: mediaUsageWhere,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        target: true,
        targetId: true,
        role: true,
        sortOrder: true,
        mediaAsset: {
          select: {
            id: true,
            type: true,
            status: true,
            provider: true,
            publicUrl: true,
            originalUrl: true,
            title: true,
            altText: true,
            dominantColor: true,
          },
        },
      },
    });

    return {
      company,
      branch,
      profile,
      source: profile?.branchId === branch.id ? 'branch' : 'company',
      theme: profile?.theme ?? null,
      designTokens: profile?.designTokens ?? null,
      motionTokens: profile?.motionTokens ?? null,
      layoutConfig: profile?.layoutConfig ?? null,
      brandVoice: profile?.brandVoice ?? null,
      aiWaiterTone: profile?.aiWaiterTone ?? null,
      contentBlocks,
      venueZones,
      mediaUsages,
    };
  }

  async previewBalkonaPack(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);

    return {
      branch,
      experienceProfile: this.balkonaProfilePayload(
        branch.companyId,
        branch.id,
      ),
      contentBlocks: balkonaContentBlocks,
      notificationTemplates: balkonaNotificationTemplates,
      venueZones: balkonaVenueZones,
      mediaPlaceholders: [],
      mutates: false,
    };
  }

  async applyBalkonaPack(branchId: string) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchOrThrow(branchId, tx);
      const profilePayload = this.balkonaProfilePayload(
        branch.companyId,
        branch.id,
      );
      const existingProfile = await tx.experienceProfile.findFirst({
        where: {
          companyId: branch.companyId,
          branchId: branch.id,
          key: BALKONA_PACK_KEY,
          language: BALKONA_PACK_LANGUAGE,
        },
        select: { id: true },
      });

      await tx.experienceProfile.updateMany({
        where: {
          companyId: branch.companyId,
          branchId: branch.id,
          language: BALKONA_PACK_LANGUAGE,
          isDefault: true,
          ...(existingProfile ? { id: { not: existingProfile.id } } : {}),
        },
        data: { isDefault: false },
      });

      const experienceProfile = existingProfile
        ? await tx.experienceProfile.update({
            where: { id: existingProfile.id },
            data: profilePayload,
            select: experienceProfileSelect,
          })
        : await tx.experienceProfile.create({
            data: profilePayload,
            select: experienceProfileSelect,
          });

      const contentBlocks: ContentBlockRecord[] = [];

      for (const block of balkonaContentBlocks) {
        const existingBlock = await tx.contentBlock.findFirst({
          where: {
            companyId: branch.companyId,
            branchId: branch.id,
            placement: block.placement,
            key: block.key,
            language: BALKONA_PACK_LANGUAGE,
          },
          select: { id: true },
        });
        const data = {
          companyId: branch.companyId,
          branchId: branch.id,
          experienceProfileId: experienceProfile.id,
          placement: block.placement,
          key: block.key,
          language: BALKONA_PACK_LANGUAGE,
          status: ContentBlockStatus.active,
          title: block.title,
          body: block.body,
          sortOrder: block.sortOrder,
          metadata: {
            source: 'balkona_experience_pack',
          },
        };

        contentBlocks.push(
          existingBlock
            ? await tx.contentBlock.update({
                where: { id: existingBlock.id },
                data,
                select: contentBlockSelect,
              })
            : await tx.contentBlock.create({
                data,
                select: contentBlockSelect,
              }),
        );
      }

      const notificationTemplates: NotificationTemplateRecord[] = [];

      for (const template of balkonaNotificationTemplates) {
        notificationTemplates.push(
          await tx.notificationTemplate.upsert({
            where: {
              companyId_branchId_key_channel_language: {
                companyId: branch.companyId,
                branchId: branch.id,
                key: template.key,
                channel: NotificationChannel.in_app,
                language: BALKONA_PACK_LANGUAGE,
              },
            },
            update: {
              kind: template.kind,
              title: template.title,
              body: template.body,
              isActive: true,
              metadata: {
                source: 'balkona_experience_pack',
              },
            },
            create: {
              companyId: branch.companyId,
              branchId: branch.id,
              key: template.key,
              kind: template.kind,
              channel: template.channel,
              language: BALKONA_PACK_LANGUAGE,
              title: template.title,
              body: template.body,
              isActive: true,
              metadata: {
                source: 'balkona_experience_pack',
              },
            },
            select: notificationTemplateSelect,
          }),
        );
      }

      const venueZones: VenueZoneRecord[] = [];

      for (const zone of balkonaVenueZones) {
        venueZones.push(
          await tx.venueZone.upsert({
            where: {
              branchId_slug: {
                branchId: branch.id,
                slug: zone.slug,
              },
            },
            update: {
              name: zone.name,
              type: zone.type,
              status: VenueZoneStatus.active,
              description: zone.description,
              metadata: zone.metadata,
            },
            create: {
              companyId: branch.companyId,
              branchId: branch.id,
              name: zone.name,
              slug: zone.slug,
              type: zone.type,
              status: VenueZoneStatus.active,
              description: zone.description,
              metadata: zone.metadata,
            },
            select: venueZoneSelect,
          }),
        );
      }

      return {
        branch,
        experienceProfile,
        contentBlocks: {
          count: contentBlocks.length,
          items: contentBlocks,
        },
        notificationTemplates: {
          count: notificationTemplates.length,
          items: notificationTemplates,
        },
        venueZones: {
          count: venueZones.length,
          items: venueZones,
        },
        mediaPlaceholders: {
          count: 0,
          items: [],
        },
      };
    });
  }

  private async listProfiles(
    scope: ExperienceScope,
    query: ListExperienceProfilesQueryDto,
  ) {
    const where: Prisma.ExperienceProfileWhereInput = {
      companyId: scope.companyId,
      branchId: scope.branchId,
      scope: scope.scope,
    };

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.language) {
      where.language = query.language.trim();
    }

    return this.prisma.experienceProfile.findMany({
      where,
      take: this.limit(query.limit),
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: experienceProfileSelect,
    });
  }

  private async createProfile(
    scope: ExperienceScope,
    body: CreateExperienceProfileDto,
    tx: Prisma.TransactionClient,
  ) {
    this.assertRequiredJson(body.theme, 'theme');
    this.assertRequiredJson(body.designTokens, 'designTokens');

    if (body.isDefault) {
      await this.clearDefaultProfiles(
        {
          companyId: scope.companyId,
          branchId: scope.branchId,
          scope: scope.scope,
          language: this.normalizeLanguage(body.language),
        },
        tx,
      );
    }

    return tx.experienceProfile.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        scope: scope.scope,
        key: body.key.trim(),
        name: body.name.trim(),
        status:
          body.status ??
          (body.isDefault
            ? ExperienceProfileStatus.active
            : ExperienceProfileStatus.draft),
        isDefault: body.isDefault ?? false,
        language: this.normalizeLanguage(body.language),
        theme: this.toJson(body.theme),
        designTokens: this.toJson(body.designTokens),
        motionTokens: this.toNullableJson(body.motionTokens),
        layoutConfig: this.toNullableJson(body.layoutConfig),
        brandVoice: this.toNullableJson(body.brandVoice),
        aiWaiterTone: this.toNullableJson(body.aiWaiterTone),
        metadata: this.toNullableJson(body.metadata),
      },
      select: experienceProfileSelect,
    });
  }

  private async findEffectiveProfile(branch: {
    id: string;
    companyId: string;
  }) {
    const branchDefault = await this.prisma.experienceProfile.findFirst({
      where: {
        companyId: branch.companyId,
        branchId: branch.id,
        status: ExperienceProfileStatus.active,
        isDefault: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
      select: experienceProfileSelect,
    });

    if (branchDefault) {
      return branchDefault;
    }

    const companyDefault = await this.prisma.experienceProfile.findFirst({
      where: {
        companyId: branch.companyId,
        branchId: null,
        status: ExperienceProfileStatus.active,
        isDefault: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
      select: experienceProfileSelect,
    });

    if (companyDefault) {
      return companyDefault;
    }

    return this.prisma.experienceProfile.findFirst({
      where: {
        companyId: branch.companyId,
        status: ExperienceProfileStatus.active,
        OR: [{ branchId: branch.id }, { branchId: null }],
      },
      orderBy: [{ branchId: 'desc' }, { updatedAt: 'desc' }],
      select: experienceProfileSelect,
    });
  }

  private async clearDefaultProfiles(
    profile: Pick<
      ExperienceProfileRecord,
      'companyId' | 'branchId' | 'scope' | 'language'
    >,
    tx: Prisma.TransactionClient,
  ) {
    await tx.experienceProfile.updateMany({
      where: {
        companyId: profile.companyId,
        branchId: profile.branchId,
        scope: profile.scope,
        language: profile.language,
        isDefault: true,
      },
      data: { isDefault: false },
    });
  }

  private async findProfileOrThrow(
    experienceProfileId: string,
    tx: PrismaExecutor,
  ): Promise<ExperienceProfileRecord> {
    const profile = await tx.experienceProfile.findUnique({
      where: { id: experienceProfileId },
      select: experienceProfileSelect,
    });

    if (!profile) {
      throw new NotFoundException('Experience profile not found');
    }

    return profile;
  }

  private async findCompanyOrThrow(companyId: string, tx: PrismaExecutor) {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: companySelect,
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  private async findBranchOrThrow(branchId: string, tx: PrismaExecutor) {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: branchSelect,
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private balkonaProfilePayload(companyId: string, branchId: string) {
    return {
      companyId,
      branchId,
      scope: ExperienceProfileScope.branch,
      key: BALKONA_PACK_KEY,
      name: 'Balkona Bar — فوق الدوشة',
      status: ExperienceProfileStatus.active,
      isDefault: true,
      language: BALKONA_PACK_LANGUAGE,
      theme: balkonaTheme,
      designTokens: balkonaDesignTokens,
      motionTokens: balkonaMotionTokens,
      layoutConfig: balkonaLayoutConfig,
      brandVoice: balkonaBrandVoice,
      aiWaiterTone: balkonaAiWaiterTone,
      metadata: {
        source: 'balkona_experience_pack',
        binaryUploads: false,
        aiWaiterImplemented: false,
      },
    };
  }

  private assignJson(
    data: Prisma.ExperienceProfileUpdateInput,
    body: UpdateExperienceProfileDto,
    key:
      | 'theme'
      | 'designTokens'
      | 'motionTokens'
      | 'layoutConfig'
      | 'brandVoice'
      | 'aiWaiterTone'
      | 'metadata',
  ) {
    if (this.hasOwn(body, key)) {
      data[key] =
        key === 'theme' || key === 'designTokens'
          ? this.toJson(body[key])
          : this.toNullableJson(body[key]);
    }
  }

  private assertRequiredJson(value: unknown, label: string) {
    if (value === undefined || value === null) {
      throw new BadRequestException(`${label} is required`);
    }
  }

  private normalizeLanguage(value?: string) {
    const normalizedValue = value?.trim();

    return normalizedValue && normalizedValue.length > 0
      ? normalizedValue
      : 'ar-EG';
  }

  private limit(value?: number) {
    return value ?? 100;
  }

  private toJson(value: unknown) {
    if (value === undefined || value === null) {
      throw new BadRequestException('Required JSON value is missing');
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

  private hasOwn(value: object, key: string) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }
}
