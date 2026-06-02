import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  AuditActorType,
  BranchFeatureFlagKey,
  BranchOperatingMode,
  BranchServiceMode,
  Prisma,
  RealtimeEventChannel,
  RealtimeEventType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { BRANCH_FEATURE_FLAG_KEYS } from './dto/branch-settings-values';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { UpdateOperatingSettingsDto } from './dto/update-operating-settings.dto';

const DEFAULT_FEATURE_FLAG_ENABLED = true;

@Injectable()
export class BranchSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async getOperatingSettings(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId);
    const settings = await this.findOrCreateOperatingSettings(branch);

    return { branch, settings };
  }

  async updateOperatingSettings(
    branchId: string,
    body: UpdateOperatingSettingsDto = {},
  ) {
    const branch = await this.findBranchOrThrow(branchId);
    const existing = await this.findOrCreateOperatingSettings(branch);
    const data = this.operatingSettingsData(body);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide operating settings to update');
    }

    const settings = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.branchOperatingSettings.update({
        where: { branchId },
        data,
      });

      await this.auditService.recordAuditLog(
        {
          companyId: branch.companyId,
          branchId,
          actorType: AuditActorType.system,
          targetType: 'branch_operating_settings',
          targetId: updated.id,
          action: AuditAction.settings_updated,
          before: existing,
          after: updated,
        },
        tx,
      );
      await this.recordSettingsRealtimeEvent(branch, {
        kind: 'operating_settings_updated',
        settingsId: updated.id,
      }, tx);

      return updated;
    });

    return { branch, settings };
  }

  async listFeatureFlags(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId);
    const storedFlags = await this.prisma.branchFeatureFlag.findMany({
      where: { branchId },
      orderBy: [{ key: 'asc' }],
    });
    const storedByKey = new Map(storedFlags.map((flag) => [flag.key, flag]));

    return {
      branch,
      featureFlags: BRANCH_FEATURE_FLAG_KEYS.map((key) => {
        const stored = storedByKey.get(key as BranchFeatureFlagKey);

        return (
          stored ?? {
            id: null,
            companyId: branch.companyId,
            branchId,
            key,
            enabled: DEFAULT_FEATURE_FLAG_ENABLED,
            config: null,
            createdAt: null,
            updatedAt: null,
          }
        );
      }),
    };
  }

  async updateFeatureFlag(
    branchId: string,
    key: BranchFeatureFlagKey,
    body: UpdateFeatureFlagDto = {},
  ) {
    const branch = await this.findBranchOrThrow(branchId);
    const existing = await this.prisma.branchFeatureFlag.findUnique({
      where: { branchId_key: { branchId, key } },
    });
    const enabled = body.enabled ?? existing?.enabled ?? DEFAULT_FEATURE_FLAG_ENABLED;
    const config = Object.prototype.hasOwnProperty.call(body, 'config')
      ? body.config
      : existing?.config;

    const featureFlag = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.branchFeatureFlag.upsert({
        where: { branchId_key: { branchId, key } },
        create: {
          companyId: branch.companyId,
          branchId,
          key,
          enabled,
          config: this.optionalJson(config),
        },
        update: {
          enabled,
          config: this.optionalJson(config),
        },
      });

      await this.auditService.recordAuditLog(
        {
          companyId: branch.companyId,
          branchId,
          actorType: AuditActorType.system,
          targetType: 'branch_feature_flag',
          targetId: updated.id,
          action: AuditAction.feature_flag_updated,
          before: existing,
          after: updated,
        },
        tx,
      );
      await this.recordSettingsRealtimeEvent(branch, {
        kind: 'feature_flag_updated',
        key,
        enabled: updated.enabled,
      }, tx);

      return updated;
    });

    return { branch, featureFlag };
  }

  private async findBranchOrThrow(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async findOrCreateOperatingSettings(branch: {
    id: string;
    companyId: string;
  }) {
    return this.prisma.branchOperatingSettings.upsert({
      where: { branchId: branch.id },
      create: {
        companyId: branch.companyId,
        branchId: branch.id,
      },
      update: {},
    });
  }

  private operatingSettingsData(body: UpdateOperatingSettingsDto) {
    const data: Prisma.BranchOperatingSettingsUpdateInput = {};

    if (body.operatingMode !== undefined) {
      data.operatingMode = body.operatingMode as BranchOperatingMode;
    }

    if (body.serviceMode !== undefined) {
      data.serviceMode = body.serviceMode as BranchServiceMode;
    }

    for (const key of [
      'aiWaiterEnabled',
      'waiterCallsEnabled',
      'smartCashierEnabled',
      'realtimeEnabled',
      'mediaExperienceEnabled',
      'billFlowEnabled',
      'tableAttentionEnabled',
      'analyticsEnabled',
      'notificationsEnabled',
      'presenceTriggersEnabled',
    ] as const) {
      if (body[key] !== undefined) {
        data[key] = body[key];
      }
    }

    for (const key of [
      'openingHours',
      'serviceConfig',
      'attentionConfig',
      'metadata',
    ] as const) {
      if (body[key] !== undefined) {
        data[key] = this.optionalJson(body[key]);
      }
    }

    return data;
  }

  private async recordSettingsRealtimeEvent(
    branch: { companyId: string; id: string },
    payload: Record<string, unknown>,
    tx: Prisma.TransactionClient,
  ) {
    await this.realtimeEventsService.createRealtimeEvent(
      {
        companyId: branch.companyId,
        branchId: branch.id,
        type: RealtimeEventType.branch_settings_updated,
        channel: RealtimeEventChannel.system,
        payload,
      },
      tx,
    );
  }

  private optionalJson(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private branchSelect() {
    return {
      id: true,
      companyId: true,
      name: true,
      slug: true,
      address: true,
      status: true,
    };
  }
}
