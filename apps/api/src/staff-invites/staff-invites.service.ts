import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuditAction,
  AuditActorType,
  Prisma,
  StaffInviteStatus,
  StaffRole,
  StaffStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  generateOpaqueToken,
  hashToken,
  verifyTokenHash,
} from "../staff-auth/token-hash.util";
import { AcceptStaffInviteDto } from "./dto/accept-staff-invite.dto";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const PASSWORD_HASH_ROUNDS = 12;

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

const staffUserSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  passwordSetAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffUserSelect;

const staffInviteSelect = {
  id: true,
  companyId: true,
  branchId: true,
  staffUserId: true,
  email: true,
  name: true,
  role: true,
  status: true,
  tokenHash: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdByPlatformAdminId: true,
  createdByStaffUserId: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  company: { select: companySelect },
  branch: { select: branchSelect },
  staffUser: { select: staffUserSelect },
} satisfies Prisma.StaffInviteSelect;

type StaffInviteRecord = Prisma.StaffInviteGetPayload<{
  select: typeof staffInviteSelect;
}>;

export interface CreateStaffInviteInput {
  companyId: string;
  branchId?: string | null;
  staffUserId: string;
  email: string;
  name?: string | null;
  role: StaffRole;
  createdByPlatformAdminId?: string | null;
  createdByStaffUserId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class StaffInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async createStaffInvite(
    input: CreateStaffInviteInput,
    tx: PrismaExecutor = this.prisma,
  ) {
    const inviteToken = generateOpaqueToken("balcona_staff_invite");
    const tokenHash = hashToken(inviteToken);
    const email = input.email.trim().toLowerCase();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.inviteExpiresDays() * 24 * 60 * 60 * 1000,
    );
    const pendingInviteWhere = {
      companyId: input.companyId,
      status: StaffInviteStatus.pending,
      OR: [
        { email },
        ...(input.staffUserId ? [{ staffUserId: input.staffUserId }] : []),
      ],
    } satisfies Prisma.StaffInviteWhereInput;

    const revoked = await tx.staffInvite.updateMany({
      where: pendingInviteWhere,
      data: {
        status: StaffInviteStatus.revoked,
        revokedAt: now,
      },
    });
    const invite = await tx.staffInvite.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId ?? null,
        staffUserId: input.staffUserId,
        email,
        name: this.normalizeOptionalText(input.name),
        role: input.role,
        tokenHash,
        expiresAt,
        createdByPlatformAdminId: input.createdByPlatformAdminId ?? null,
        createdByStaffUserId: input.createdByStaffUserId ?? null,
        metadata: this.toJson({
          ...(input.metadata ?? {}),
          revokedPendingInviteCount: revoked.count,
        }),
      },
      select: staffInviteSelect,
    });

    await this.recordInviteCreatedAudit(invite, tx);

    return {
      invite: this.toInviteSummary(invite),
      inviteToken,
      invitePath: this.invitePath(inviteToken),
    };
  }

  async getInviteByToken(token: string) {
    const invite = await this.findInviteByTokenOrThrow(token, this.prisma);
    const refreshed = await this.refreshExpiredInvite(invite, this.prisma);

    return {
      invite: this.toInviteSummary(refreshed),
      canAccept: this.canAccept(refreshed),
      staffLoginPath: "/staff/login",
    };
  }

  async acceptInvite(token: string, body: AcceptStaffInviteDto) {
    return this.prisma.$transaction(async (tx) => {
      const invite = await this.findInviteByTokenOrThrow(token, tx);
      const now = new Date();

      if (invite.status === StaffInviteStatus.pending && invite.expiresAt <= now) {
        const expiredInvite = await tx.staffInvite.update({
          where: { id: invite.id },
          data: { status: StaffInviteStatus.expired },
          select: staffInviteSelect,
        });

        throw new BadRequestException(
          this.inviteStatusMessage(expiredInvite.status),
        );
      }

      if (!this.canAccept(invite, now)) {
        throw new BadRequestException(this.inviteStatusMessage(invite.status));
      }

      if (!invite.staffUserId) {
        throw new BadRequestException("Staff invite is no longer valid");
      }

      const passwordHash = await bcrypt.hash(body.password, PASSWORD_HASH_ROUNDS);
      const staffUser = await tx.staffUser.update({
        where: { id: invite.staffUserId },
        data: {
          passwordHash,
          passwordSetAt: now,
          status: StaffStatus.active,
          ...(invite.name ? { name: invite.name } : {}),
        },
        select: staffUserSelect,
      });
      const acceptedInvite = await tx.staffInvite.update({
        where: { id: invite.id },
        data: {
          status: StaffInviteStatus.accepted,
          acceptedAt: now,
        },
        select: staffInviteSelect,
      });

      await tx.staffInvite.updateMany({
        where: {
          companyId: invite.companyId,
          id: { not: invite.id },
          status: StaffInviteStatus.pending,
          OR: [{ email: invite.email }, { staffUserId: invite.staffUserId }],
        },
        data: {
          status: StaffInviteStatus.revoked,
          revokedAt: now,
        },
      });
      await this.auditService.recordAuditLog(
        {
          companyId: invite.companyId,
          branchId: invite.branchId,
          actorType: AuditActorType.staff,
          actorStaffUserId: staffUser.id,
          targetType: "staff_invite",
          targetId: invite.id,
          action: AuditAction.staff_invite_accepted,
          metadata: {
            email: invite.email,
            role: invite.role,
          },
        },
        tx,
      );

      return {
        invite: this.toInviteSummary(acceptedInvite),
        staffUser,
        staffLoginPath: "/staff/login",
      };
    });
  }

  private async findInviteByTokenOrThrow(
    token: string,
    tx: PrismaExecutor,
  ): Promise<StaffInviteRecord> {
    const invite = await tx.staffInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      select: staffInviteSelect,
    });

    if (!invite || !verifyTokenHash(token, invite.tokenHash)) {
      throw new NotFoundException("Staff invite not found");
    }

    return invite;
  }

  private async refreshExpiredInvite(
    invite: StaffInviteRecord,
    tx: PrismaExecutor,
  ) {
    if (
      invite.status !== StaffInviteStatus.pending ||
      invite.expiresAt > new Date()
    ) {
      return invite;
    }

    return tx.staffInvite.update({
      where: { id: invite.id },
      data: { status: StaffInviteStatus.expired },
      select: staffInviteSelect,
    });
  }

  private async recordInviteCreatedAudit(
    invite: StaffInviteRecord,
    tx: PrismaExecutor,
  ) {
    if (invite.createdByStaffUserId) {
      await this.auditService.recordAuditLog(
        {
          companyId: invite.companyId,
          branchId: invite.branchId,
          actorType: AuditActorType.staff,
          actorStaffUserId: invite.createdByStaffUserId,
          targetType: "staff_invite",
          targetId: invite.id,
          action: AuditAction.staff_invite_created,
          metadata: {
            email: invite.email,
            role: invite.role,
            staffUserId: invite.staffUserId,
            expiresAt: invite.expiresAt,
          },
        },
        tx,
      );
    }

    if (invite.createdByPlatformAdminId) {
      await tx.platformAuditEvent.create({
        data: {
          platformAdminUserId: invite.createdByPlatformAdminId,
          action: "staff_invite_created",
          targetType: "staff_invite",
          targetId: invite.id,
          metadata: this.toJson({
            companyId: invite.companyId,
            branchId: invite.branchId,
            staffUserId: invite.staffUserId,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expiresAt,
          }),
        },
      });
    }
  }

  private canAccept(invite: StaffInviteRecord, now = new Date()) {
    return (
      invite.status === StaffInviteStatus.pending && invite.expiresAt > now
    );
  }

  private inviteStatusMessage(status: StaffInviteStatus) {
    if (status === StaffInviteStatus.accepted) {
      return "Staff invite has already been accepted";
    }

    if (status === StaffInviteStatus.revoked) {
      return "Staff invite has been revoked";
    }

    if (status === StaffInviteStatus.expired) {
      return "Staff invite has expired";
    }

    return "Staff invite cannot be accepted";
  }

  private toInviteSummary(invite: StaffInviteRecord) {
    return {
      id: invite.id,
      companyId: invite.companyId,
      branchId: invite.branchId,
      staffUserId: invite.staffUserId,
      email: invite.email,
      name: invite.name,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      revokedAt: invite.revokedAt,
      createdAt: invite.createdAt,
      updatedAt: invite.updatedAt,
      company: invite.company,
      branch: invite.branch,
      staffUser: invite.staffUser,
    };
  }

  private invitePath(token: string) {
    return `/staff/invite/${encodeURIComponent(token)}`;
  }

  private inviteExpiresDays() {
    return this.configService.get<number>("staffAuth.inviteExpiresDays", 7);
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : null;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
