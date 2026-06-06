import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import {
  PlatformAdminRole,
  PlatformAdminSessionStatus,
  PlatformAdminStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PlatformAuthService } from "./platform-auth.service";

const now = new Date("2026-06-06T10:00:00.000Z");

function platformAdmin(overrides: Record<string, unknown> = {}) {
  return {
    id: "platform-admin-1",
    email: "platform@balcona.local",
    name: "Platform Admin",
    passwordHash: "",
    role: PlatformAdminRole.owner,
    status: PlatformAdminStatus.active,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService() {
  const prisma = {
    platformAdminUser: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    platformAdminSession: {
      create: jest.fn().mockResolvedValue({
        id: "platform-session-1",
        platformAdminUserId: "platform-admin-1",
        status: PlatformAdminSessionStatus.active,
        expiresAt: new Date("2026-06-06T22:00:00.000Z"),
        revokedAt: null,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    platformAuditEvent: {
      create: jest.fn().mockResolvedValue({ id: "event-1" }),
    },
  };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === "platformAuth.sessionHours") {
        return 12;
      }

      return fallback;
    }),
  };

  return {
    service: new PlatformAuthService(prisma as never, configService as never),
    prisma,
  };
}

describe("PlatformAuthService", () => {
  it("logs in an active platform admin", async () => {
    const { service, prisma } = createService();
    const passwordHash = await bcrypt.hash("secret", 12);
    const admin = platformAdmin({ passwordHash });
    prisma.platformAdminUser.findUnique.mockResolvedValue(admin);
    prisma.platformAdminUser.update.mockResolvedValue({
      ...admin,
      lastLoginAt: now,
    });

    const result = await service.login({
      email: "Platform@Balcona.Local",
      password: "secret",
    });

    expect(result.accessToken).toMatch(/^balcona_platform_/);
    expect(result.platformAdminUser).toMatchObject({
      id: admin.id,
      email: admin.email,
      role: PlatformAdminRole.owner,
    });
    expect(prisma.platformAdminSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platformAdminUserId: admin.id,
        }),
      }),
    );
    expect(prisma.platformAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "platform_admin_login",
          targetType: "platform_admin_session",
        }),
      }),
    );
  });

  it("rejects a wrong password", async () => {
    const { service, prisma } = createService();
    prisma.platformAdminUser.findUnique.mockResolvedValue(
      platformAdmin({ passwordHash: await bcrypt.hash("correct", 12) }),
    );

    await expect(
      service.login({
        email: "platform@balcona.local",
        password: "wrong",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.platformAdminSession.create).not.toHaveBeenCalled();
  });

  it("rejects a disabled platform admin", async () => {
    const { service, prisma } = createService();
    prisma.platformAdminUser.findUnique.mockResolvedValue(
      platformAdmin({
        passwordHash: await bcrypt.hash("secret", 12),
        status: PlatformAdminStatus.disabled,
      }),
    );

    await expect(
      service.login({
        email: "platform@balcona.local",
        password: "secret",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.platformAdminSession.create).not.toHaveBeenCalled();
  });
});
