import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PlatformAdminSessionStatus,
  PlatformAdminStatus,
  Prisma,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import {
  generateOpaqueToken,
  hashToken,
  verifyTokenHash,
} from "../staff-auth/token-hash.util";
import { PlatformLoginDto } from "./dto/platform-login.dto";

const platformAdminUserSelect = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlatformAdminUserSelect;

const platformAdminSessionSelect = {
  id: true,
  platformAdminUserId: true,
  status: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlatformAdminSessionSelect;

type PlatformAdminUserForAuth = Prisma.PlatformAdminUserGetPayload<{
  select: typeof platformAdminUserSelect;
}>;

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    body: PlatformLoginDto,
    requestMeta: { userAgent?: string; ipAddress?: string } = {},
  ) {
    const email = body.email.trim().toLowerCase();
    const platformAdminUser = await this.prisma.platformAdminUser.findUnique({
      where: { email },
      select: platformAdminUserSelect,
    });

    if (!platformAdminUser) {
      throw new UnauthorizedException("Invalid platform credentials");
    }

    if (platformAdminUser.status !== PlatformAdminStatus.active) {
      throw new ForbiddenException("Platform admin is disabled");
    }

    const passwordMatches = await bcrypt.compare(
      body.password,
      platformAdminUser.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid platform credentials");
    }

    const accessToken = generateOpaqueToken("balcona_platform");
    const expiresAt = new Date(
      Date.now() + this.sessionHours() * 60 * 60 * 1000,
    );
    const session = await this.prisma.platformAdminSession.create({
      data: {
        platformAdminUserId: platformAdminUser.id,
        tokenHash: hashToken(accessToken),
        userAgent: requestMeta.userAgent,
        ipAddress: requestMeta.ipAddress,
        expiresAt,
      },
      select: platformAdminSessionSelect,
    });
    const updatedPlatformAdminUser =
      await this.prisma.platformAdminUser.update({
        where: { id: platformAdminUser.id },
        data: { lastLoginAt: new Date() },
        select: platformAdminUserSelect,
      });

    await this.prisma.platformAuditEvent.create({
      data: {
        platformAdminUserId: platformAdminUser.id,
        action: "platform_admin_login",
        targetType: "platform_admin_session",
        targetId: session.id,
        metadata: {
          userAgent: requestMeta.userAgent,
        },
      },
    });

    return {
      accessToken,
      expiresAt,
      platformAdminUser: this.serializePlatformAdminUser(
        updatedPlatformAdminUser,
      ),
      platformAdminSession: session,
    };
  }

  async validateToken(token: string) {
    const tokenHash = hashToken(token);
    const session = await this.prisma.platformAdminSession.findUnique({
      where: { tokenHash },
      select: {
        ...platformAdminSessionSelect,
        tokenHash: true,
        platformAdminUser: { select: platformAdminUserSelect },
      },
    });

    if (
      !session ||
      !verifyTokenHash(token, session.tokenHash) ||
      session.status !== PlatformAdminSessionStatus.active ||
      session.platformAdminUser.status !== PlatformAdminStatus.active
    ) {
      throw new UnauthorizedException("Invalid platform session");
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.platformAdminSession.update({
        where: { id: session.id },
        data: { status: PlatformAdminSessionStatus.expired },
      });
      throw new UnauthorizedException("Platform session expired");
    }

    await this.prisma.platformAdminSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      platformAdminUser: this.serializePlatformAdminUser(
        session.platformAdminUser,
      ),
      platformAdminSession: this.serializeSession(session),
    };
  }

  async expireOldSessions() {
    const result = await this.prisma.platformAdminSession.updateMany({
      where: {
        status: PlatformAdminSessionStatus.active,
        expiresAt: { lte: new Date() },
      },
      data: { status: PlatformAdminSessionStatus.expired },
    });

    return { expiredPlatformAdminSessions: result.count };
  }

  private sessionHours() {
    return this.configService.get<number>("platformAuth.sessionHours", 12);
  }

  private serializePlatformAdminUser(
    platformAdminUser: PlatformAdminUserForAuth,
  ) {
    return {
      id: platformAdminUser.id,
      email: platformAdminUser.email,
      name: platformAdminUser.name,
      role: platformAdminUser.role,
      status: platformAdminUser.status,
      lastLoginAt: platformAdminUser.lastLoginAt,
      createdAt: platformAdminUser.createdAt,
      updatedAt: platformAdminUser.updatedAt,
    };
  }

  private serializeSession(
    session: Prisma.PlatformAdminSessionGetPayload<{
      select: typeof platformAdminSessionSelect & { tokenHash?: true };
    }>,
  ) {
    return {
      id: session.id,
      platformAdminUserId: session.platformAdminUserId,
      status: session.status,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
