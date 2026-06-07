import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  AuditActorType,
  Prisma,
  StaffSessionStatus,
  StaffStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StaffAccessService } from '../staff/staff-access.service';
import { BootstrapPasswordDto } from './dto/bootstrap-password.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { generateOpaqueToken, hashToken, verifyTokenHash } from './token-hash.util';

const PASSWORD_HASH_ROUNDS = 12;

const staffUserAuthSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  passwordHash: true,
  passwordSetAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  memberships: {
    where: { status: StaffStatus.active },
    orderBy: [{ companyId: 'asc' as const }, { branchId: 'asc' as const }],
    select: {
      id: true,
      companyId: true,
      branchId: true,
      role: true,
      status: true,
      company: {
        select: { id: true, name: true, slug: true, status: true },
      },
      branch: {
        select: {
          id: true,
          companyId: true,
          name: true,
          slug: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.StaffUserSelect;

const staffSessionSelect = {
  id: true,
  companyId: true,
  branchId: true,
  staffUserId: true,
  status: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffSessionSelect;

type StaffUserForAuth = Prisma.StaffUserGetPayload<{
  select: typeof staffUserAuthSelect;
}>;

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly staffAccessService: StaffAccessService,
    private readonly auditService: AuditService,
  ) {}

  async login(
    body: StaffLoginDto,
    requestMeta: { userAgent?: string; ipAddress?: string } = {},
  ) {
    const staffUser = await this.prisma.staffUser.findUnique({
      where: { email: body.email.toLowerCase() },
      select: staffUserAuthSelect,
    });

    if (!staffUser || staffUser.status !== StaffStatus.active) {
      throw new UnauthorizedException('Invalid staff credentials');
    }

    if (!staffUser.passwordHash) {
      throw new BadRequestException('Staff password is not set');
    }

    const passwordMatches = await bcrypt.compare(
      body.password,
      staffUser.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid staff credentials');
    }

    const scope = await this.resolveLoginScope(staffUser, body.branchId);
    const accessToken = generateOpaqueToken('balcona_staff');
    const expiresAt = new Date(
      Date.now() + this.sessionHours() * 60 * 60 * 1000,
    );
    const session = await this.prisma.staffSession.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        staffUserId: staffUser.id,
        tokenHash: hashToken(accessToken),
        userAgent: requestMeta.userAgent,
        ipAddress: requestMeta.ipAddress,
        expiresAt,
      },
      select: staffSessionSelect,
    });

    await this.prisma.staffUser.update({
      where: { id: staffUser.id },
      data: { lastLoginAt: new Date() },
    });
    await this.auditService.recordAuditLog({
      companyId: scope.companyId,
      branchId: scope.branchId,
      actorType: AuditActorType.staff,
      actorStaffUserId: staffUser.id,
      targetType: 'staff_session',
      targetId: session.id,
      action: AuditAction.staff_login,
      metadata: { userAgent: requestMeta.userAgent },
    });

    const access = await this.staffAccessService.getAccess(staffUser.id);

    return {
      accessToken,
      expiresAt,
      staffUser: this.serializeStaffUser(staffUser),
      staffSession: session,
      memberships: access.memberships,
      effectivePermissions: access.effectiveAccess.permissions,
      effectiveAccess: access.effectiveAccess,
      defaultBranch: scope.defaultBranch,
    };
  }

  async logout(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException('Staff token is required');
    }

    const tokenHash = hashToken(token);
    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash },
      select: staffSessionSelect,
    });

    if (!session) {
      return { revoked: false };
    }

    if (session.status === StaffSessionStatus.active) {
      await this.prisma.staffSession.update({
        where: { id: session.id },
        data: {
          status: StaffSessionStatus.revoked,
          revokedAt: new Date(),
        },
      });
      await this.auditService.recordAuditLog({
        companyId: session.companyId,
        branchId: session.branchId,
        actorType: AuditActorType.staff,
        actorStaffUserId: session.staffUserId,
        targetType: 'staff_session',
        targetId: session.id,
        action: AuditAction.staff_logout,
      });
    }

    return { revoked: true };
  }

  async validateToken(token: string) {
    const tokenHash = hashToken(token);
    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash },
      select: {
        ...staffSessionSelect,
        tokenHash: true,
        staffUser: { select: staffUserAuthSelect },
      },
    });

    if (
      !session ||
      !verifyTokenHash(token, session.tokenHash) ||
      session.status !== StaffSessionStatus.active ||
      session.staffUser.status !== StaffStatus.active
    ) {
      throw new UnauthorizedException('Invalid staff session');
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.staffSession.update({
        where: { id: session.id },
        data: { status: StaffSessionStatus.expired },
      });
      throw new UnauthorizedException('Staff session expired');
    }

    await this.prisma.staffSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
    const access = await this.staffAccessService.getAccess(session.staffUserId);

    return {
      staffUser: this.serializeStaffUser(session.staffUser),
      staffSession: this.serializeSession(session),
      memberships: access.memberships,
      effectiveAccess: access.effectiveAccess,
    };
  }

  async bootstrapPassword(body: BootstrapPasswordDto) {
    const environment = this.configService.get<string>(
      'app.environment',
      'development',
    );
    const enabled = this.configService.get<boolean>(
      'staffAuth.devBootstrapEnabled',
      false,
    );
    const protectedRuntime =
      environment === 'production' || environment === 'staging';

    if (protectedRuntime && !enabled) {
      throw new ForbiddenException('Dev password bootstrap is disabled');
    }

    const staffUser = await this.prisma.staffUser.findUnique({
      where: { email: body.email.toLowerCase() },
      select: { id: true, email: true, name: true, status: true },
    });

    if (!staffUser) {
      throw new NotFoundException('Staff user not found');
    }

    const passwordHash = await bcrypt.hash(body.password, PASSWORD_HASH_ROUNDS);
    const updated = await this.prisma.staffUser.update({
      where: { id: staffUser.id },
      data: { passwordHash, passwordSetAt: new Date() },
      select: staffUserAuthSelect,
    });
    const primaryMembership = updated.memberships[0];

    if (primaryMembership) {
      await this.auditService.recordAuditLog({
        companyId: primaryMembership.companyId,
        branchId: primaryMembership.branchId,
        actorType: AuditActorType.dev,
        actorStaffUserId: updated.id,
        targetType: 'staff_user',
        targetId: updated.id,
        action: AuditAction.staff_password_bootstrapped,
      });
    }

    return {
      staffUser: this.serializeStaffUser(updated),
      passwordSetAt: updated.passwordSetAt,
      devOnly: true,
    };
  }

  async expireOldSessions() {
    const result = await this.prisma.staffSession.updateMany({
      where: {
        status: StaffSessionStatus.active,
        expiresAt: { lte: new Date() },
      },
      data: { status: StaffSessionStatus.expired },
    });

    return { expiredStaffSessions: result.count };
  }

  private async resolveLoginScope(
    staffUser: StaffUserForAuth,
    requestedBranchId?: string,
  ) {
    if (staffUser.memberships.length === 0) {
      throw new ForbiddenException('No active staff membership');
    }

    if (requestedBranchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: requestedBranchId },
        select: { id: true, companyId: true, name: true, slug: true, status: true },
      });

      if (!branch) {
        throw new NotFoundException('Branch not found');
      }

      const hasMembership = staffUser.memberships.some(
        (membership) =>
          membership.companyId === branch.companyId &&
          (!membership.branchId || membership.branchId === branch.id),
      );

      if (!hasMembership) {
        throw new ForbiddenException('No active membership for branch');
      }

      return {
        companyId: branch.companyId,
        branchId: branch.id,
        defaultBranch: branch,
      };
    }

    const branchMembership = staffUser.memberships.find(
      (membership) => membership.branch,
    );

    if (branchMembership?.branch) {
      return {
        companyId: branchMembership.companyId,
        branchId: branchMembership.branch.id,
        defaultBranch: branchMembership.branch,
      };
    }

    const companyMembership = staffUser.memberships[0];
    const firstBranch = await this.prisma.branch.findFirst({
      where: { companyId: companyMembership.companyId },
      orderBy: [{ slug: 'asc' }, { id: 'asc' }],
      select: { id: true, companyId: true, name: true, slug: true, status: true },
    });

    return {
      companyId: companyMembership.companyId,
      branchId: firstBranch?.id,
      defaultBranch: firstBranch,
    };
  }

  private sessionHours() {
    return this.configService.get<number>('staffAuth.sessionHours', 12);
  }

  private serializeStaffUser(staffUser: StaffUserForAuth) {
    return {
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      status: staffUser.status,
      lastLoginAt: staffUser.lastLoginAt,
      createdAt: staffUser.createdAt,
      updatedAt: staffUser.updatedAt,
    };
  }

  private serializeSession(
    session: Prisma.StaffSessionGetPayload<{
      select: typeof staffSessionSelect & { tokenHash?: true };
    }>,
  ) {
    return {
      id: session.id,
      companyId: session.companyId,
      branchId: session.branchId,
      staffUserId: session.staffUserId,
      status: session.status,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}

