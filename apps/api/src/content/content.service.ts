import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentBlockStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateContentBlockDto,
  ListContentBlocksQueryDto,
  UpdateContentBlockDto,
} from './dto/content-block.dto';
import {
  CreateNotificationTemplateDto,
  ListNotificationTemplatesQueryDto,
  UpdateNotificationTemplateDto,
} from './dto/notification-template.dto';

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
  branch: {
    select: branchSelect,
  },
  experienceProfile: {
    select: {
      id: true,
      key: true,
      name: true,
      status: true,
      isDefault: true,
    },
  },
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
  branch: {
    select: branchSelect,
  },
} satisfies Prisma.NotificationTemplateSelect;

type ContentScope = {
  companyId: string;
  branchId: string | null;
};

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanyBlocks(companyId: string, query: ListContentBlocksQueryDto) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const contentBlocks = await this.listBlocks(
      { companyId: company.id, branchId: null },
      query,
    );

    return { company, contentBlocks };
  }

  async listBranchBlocks(branchId: string, query: ListContentBlocksQueryDto) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const contentBlocks = await this.listBlocks(
      { companyId: branch.companyId, branchId: branch.id },
      query,
    );

    return { branch, contentBlocks };
  }

  async createCompanyBlock(companyId: string, body: CreateContentBlockDto) {
    return this.prisma.$transaction(async (tx) => {
      const company = await this.findCompanyOrThrow(companyId, tx);
      const contentBlock = await this.createBlock(
        { companyId: company.id, branchId: null },
        body,
        tx,
      );

      return { company, contentBlock };
    });
  }

  async createBranchBlock(branchId: string, body: CreateContentBlockDto) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchOrThrow(branchId, tx);
      const contentBlock = await this.createBlock(
        { companyId: branch.companyId, branchId: branch.id },
        body,
        tx,
      );

      return { branch, contentBlock };
    });
  }

  async getBlock(contentBlockId: string) {
    const contentBlock = await this.prisma.contentBlock.findUnique({
      where: { id: contentBlockId },
      select: contentBlockSelect,
    });

    if (!contentBlock) {
      throw new NotFoundException('Content block not found');
    }

    return { contentBlock };
  }

  async updateBlock(contentBlockId: string, body: UpdateContentBlockDto) {
    return this.prisma.$transaction(async (tx) => {
      const existingBlock = await tx.contentBlock.findUnique({
        where: { id: contentBlockId },
        select: {
          id: true,
          companyId: true,
          branchId: true,
        },
      });

      if (!existingBlock) {
        throw new NotFoundException('Content block not found');
      }

      const data: Prisma.ContentBlockUpdateInput = {};

      if (this.hasOwn(body, 'experienceProfileId')) {
        data.experienceProfile = body.experienceProfileId
          ? {
              connect: {
                id: await this.assertExperienceProfileScope(
                  body.experienceProfileId,
                  existingBlock.companyId,
                  existingBlock.branchId,
                  tx,
                ),
              },
            }
          : { disconnect: true };
      }

      if (body.placement !== undefined) {
        data.placement = body.placement;
      }

      if (body.key !== undefined) {
        data.key = body.key.trim();
      }

      if (body.language !== undefined) {
        data.language = this.normalizeLanguage(body.language);
      }

      if (body.status !== undefined) {
        data.status = body.status;
      }

      this.assignOptionalText(data, body, 'title');
      this.assignOptionalText(data, body, 'body');
      this.assignOptionalText(data, body, 'ctaLabel');
      this.assignOptionalText(data, body, 'ctaAction');

      if (body.sortOrder !== undefined) {
        data.sortOrder = body.sortOrder;
      }

      if (this.hasOwn(body, 'metadata')) {
        data.metadata = this.toNullableJson(body.metadata);
      }

      const contentBlock = await tx.contentBlock.update({
        where: { id: existingBlock.id },
        data,
        select: contentBlockSelect,
      });

      return { contentBlock };
    });
  }

  activateBlock(contentBlockId: string) {
    return this.updateBlockStatus(contentBlockId, ContentBlockStatus.active);
  }

  deactivateBlock(contentBlockId: string) {
    return this.updateBlockStatus(contentBlockId, ContentBlockStatus.inactive);
  }

  archiveBlock(contentBlockId: string) {
    return this.updateBlockStatus(contentBlockId, ContentBlockStatus.archived);
  }

  async listCompanyNotificationTemplates(
    companyId: string,
    query: ListNotificationTemplatesQueryDto,
  ) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const notificationTemplates = await this.listNotificationTemplates(
      { companyId: company.id, branchId: null },
      query,
    );

    return { company, notificationTemplates };
  }

  async listBranchNotificationTemplates(
    branchId: string,
    query: ListNotificationTemplatesQueryDto,
  ) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const notificationTemplates = await this.listNotificationTemplates(
      { companyId: branch.companyId, branchId: branch.id },
      query,
    );

    return { branch, notificationTemplates };
  }

  async createCompanyNotificationTemplate(
    companyId: string,
    body: CreateNotificationTemplateDto,
  ) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const notificationTemplate = await this.createNotificationTemplate(
      { companyId: company.id, branchId: null },
      body,
    );

    return { company, notificationTemplate };
  }

  async createBranchNotificationTemplate(
    branchId: string,
    body: CreateNotificationTemplateDto,
  ) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const notificationTemplate = await this.createNotificationTemplate(
      { companyId: branch.companyId, branchId: branch.id },
      body,
    );

    return { branch, notificationTemplate };
  }

  async getNotificationTemplate(templateId: string) {
    const notificationTemplate =
      await this.prisma.notificationTemplate.findUnique({
        where: { id: templateId },
        select: notificationTemplateSelect,
      });

    if (!notificationTemplate) {
      throw new NotFoundException('Notification template not found');
    }

    return { notificationTemplate };
  }

  async updateNotificationTemplate(
    templateId: string,
    body: UpdateNotificationTemplateDto,
  ) {
    try {
      const existingTemplate =
        await this.prisma.notificationTemplate.findUnique({
          where: { id: templateId },
          select: { id: true },
        });

      if (!existingTemplate) {
        throw new NotFoundException('Notification template not found');
      }

      const data: Prisma.NotificationTemplateUpdateInput = {};

      if (body.key !== undefined) {
        data.key = body.key.trim();
      }

      if (body.kind !== undefined) {
        data.kind = body.kind;
      }

      if (body.channel !== undefined) {
        data.channel = body.channel;
      }

      if (body.language !== undefined) {
        data.language = this.normalizeLanguage(body.language);
      }

      if (body.title !== undefined) {
        data.title = body.title.trim();
      }

      if (body.body !== undefined) {
        data.body = body.body.trim();
      }

      if (body.isActive !== undefined) {
        data.isActive = body.isActive;
      }

      if (this.hasOwn(body, 'metadata')) {
        data.metadata = this.toNullableJson(body.metadata);
      }

      const notificationTemplate =
        await this.prisma.notificationTemplate.update({
          where: { id: existingTemplate.id },
          data,
          select: notificationTemplateSelect,
        });

      return { notificationTemplate };
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Notification template key/channel/language must be unique in scope',
      );
    }
  }

  activateNotificationTemplate(templateId: string) {
    return this.updateNotificationTemplate(templateId, { isActive: true });
  }

  deactivateNotificationTemplate(templateId: string) {
    return this.updateNotificationTemplate(templateId, { isActive: false });
  }

  private async listBlocks(
    scope: ContentScope,
    query: ListContentBlocksQueryDto,
  ) {
    const where: Prisma.ContentBlockWhereInput = {
      companyId: scope.companyId,
      branchId: scope.branchId,
    };

    if (query.placement) {
      where.placement = query.placement;
    }

    if (query.language) {
      where.language = query.language.trim();
    }

    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.experienceProfileId) {
      await this.assertExperienceProfileScope(
        query.experienceProfileId,
        scope.companyId,
        scope.branchId,
        this.prisma,
      );
      where.experienceProfileId = query.experienceProfileId;
    }

    return this.prisma.contentBlock.findMany({
      where,
      take: this.limit(query.limit),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: contentBlockSelect,
    });
  }

  private async createBlock(
    scope: ContentScope,
    body: CreateContentBlockDto,
    tx: PrismaExecutor,
  ) {
    const experienceProfileId = body.experienceProfileId
      ? await this.assertExperienceProfileScope(
          body.experienceProfileId,
          scope.companyId,
          scope.branchId,
          tx,
        )
      : null;

    return tx.contentBlock.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        experienceProfileId,
        placement: body.placement,
        key: body.key.trim(),
        language: this.normalizeLanguage(body.language),
        status: body.status ?? ContentBlockStatus.active,
        title: this.normalizeOptionalText(body.title),
        body: this.normalizeOptionalText(body.body),
        ctaLabel: this.normalizeOptionalText(body.ctaLabel),
        ctaAction: this.normalizeOptionalText(body.ctaAction),
        sortOrder: body.sortOrder ?? 0,
        metadata: this.toNullableJson(body.metadata),
      },
      select: contentBlockSelect,
    });
  }

  private async listNotificationTemplates(
    scope: ContentScope,
    query: ListNotificationTemplatesQueryDto,
  ) {
    const where: Prisma.NotificationTemplateWhereInput = {
      companyId: scope.companyId,
      branchId: scope.branchId,
    };

    if (query.kind) {
      where.kind = query.kind;
    }

    if (query.channel) {
      where.channel = query.channel;
    }

    if (query.language) {
      where.language = query.language.trim();
    }

    if (query.active !== undefined) {
      where.isActive = query.active === 'true';
    }

    return this.prisma.notificationTemplate.findMany({
      where,
      take: this.limit(query.limit),
      orderBy: [{ kind: 'asc' }, { key: 'asc' }],
      select: notificationTemplateSelect,
    });
  }

  private async createNotificationTemplate(
    scope: ContentScope,
    body: CreateNotificationTemplateDto,
  ) {
    try {
      return await this.prisma.notificationTemplate.create({
        data: {
          companyId: scope.companyId,
          branchId: scope.branchId,
          key: body.key.trim(),
          kind: body.kind,
          channel: body.channel ?? NotificationChannel.in_app,
          language: this.normalizeLanguage(body.language),
          title: body.title.trim(),
          body: body.body.trim(),
          isActive: body.isActive ?? true,
          metadata: this.toNullableJson(body.metadata),
        },
        select: notificationTemplateSelect,
      });
    } catch (error) {
      this.handleKnownWriteError(
        error,
        'Notification template key/channel/language must be unique in scope',
      );
    }
  }

  private async updateBlockStatus(
    contentBlockId: string,
    status: ContentBlockStatus,
  ) {
    const contentBlock = await this.prisma.contentBlock.update({
      where: { id: contentBlockId },
      data: { status },
      select: contentBlockSelect,
    });

    return { contentBlock };
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

  private async assertExperienceProfileScope(
    experienceProfileId: string,
    companyId: string,
    branchId: string | null,
    tx: PrismaExecutor,
  ) {
    const experienceProfile = await tx.experienceProfile.findUnique({
      where: { id: experienceProfileId },
      select: { id: true, companyId: true, branchId: true },
    });

    if (!experienceProfile) {
      throw new NotFoundException('Experience profile not found');
    }

    if (experienceProfile.companyId !== companyId) {
      throw new BadRequestException(
        'Experience profile does not belong to company',
      );
    }

    if (branchId && experienceProfile.branchId !== branchId) {
      throw new BadRequestException(
        'Experience profile does not belong to branch',
      );
    }

    return experienceProfile.id;
  }

  private assignOptionalText(
    data: Prisma.ContentBlockUpdateInput,
    body: UpdateContentBlockDto,
    key: 'title' | 'body' | 'ctaLabel' | 'ctaAction',
  ) {
    if (this.hasOwn(body, key)) {
      data[key] = this.normalizeOptionalText(body[key]);
    }
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
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
