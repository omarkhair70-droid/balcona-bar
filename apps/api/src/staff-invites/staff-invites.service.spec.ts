import { BadRequestException } from "@nestjs/common";
import {
  BranchStatus,
  CompanyStatus,
  StaffInviteStatus,
  StaffRole,
  StaffStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { hashToken } from "../staff-auth/token-hash.util";
import { StaffInvitesService } from "./staff-invites.service";

const now = new Date("2026-06-07T10:00:00.000Z");
// Keep the default pending invite valid regardless of the wall-clock date when CI runs.
const expiresAt = new Date("2100-06-14T10:00:00.000Z");
const company = {
  id: "company-1",
  name: "Test Cafe",
  slug: "test-cafe",
  status: CompanyStatus.active,
};
const branch = {
  id: "branch-1",
  companyId: company.id,
  name: "Main",
  slug: "main",
  status: BranchStatus.active,
};
const staffUser = {
  id: "staff-1",
  email: "owner@test.local",
  name: "Owner",
  status: StaffStatus.active,
  passwordSetAt: null,
  lastLoginAt: null,
  createdAt: now,
  updatedAt: now,
};

function invite({
  token,
  status = StaffInviteStatus.pending,
  inviteExpiresAt = expiresAt,
}: {
  token: string;
  status?: StaffInviteStatus;
  inviteExpiresAt?: Date;
}) {
  return {
    id: "invite-1",
    companyId: company.id,
    branchId: branch.id,
    staffUserId: staffUser.id,
    email: staffUser.email,
    name: staffUser.name,
    role: StaffRole.owner,
    status,
    tokenHash: hashToken(token),
    expiresAt: inviteExpiresAt,
    acceptedAt:
      status === StaffInviteStatus.accepted
        ? new Date("2026-06-08T10:00:00.000Z")
        : null,
    revokedAt:
      status === StaffInviteStatus.revoked
        ? new Date("2026-06-08T10:00:00.000Z")
        : null,
    createdByPlatformAdminId: "platform-admin-1",
    createdByStaffUserId: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    company,
    branch,
    staffUser,
  };
}

function createService() {
  const prisma = {
    staffInvite: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(({ data }) =>
        Promise.resolve({
          ...invite({ token: "unused" }),
          id: "invite-created",
          tokenHash: data.tokenHash,
          email: data.email,
          name: data.name,
          role: data.role,
          branchId: data.branchId,
          staffUserId: data.staffUserId,
          expiresAt: data.expiresAt,
          createdByPlatformAdminId: data.createdByPlatformAdminId,
          createdByStaffUserId: data.createdByStaffUserId,
          metadata: data.metadata,
        }),
      ),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    staffUser: {
      update: jest.fn(),
    },
    platformAuditEvent: {
      create: jest.fn().mockResolvedValue({ id: "platform-audit-1" }),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === "staffAuth.inviteExpiresDays") {
        return 7;
      }

      return fallback;
    }),
  };
  const auditService = {
    recordAuditLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
  };
  const service = new StaffInvitesService(
    prisma as never,
    configService as never,
    auditService as never,
  );

  return { service, prisma, auditService };
}

describe("StaffInvitesService", () => {
  it("creates an invite with a one-time token and never returns tokenHash", async () => {
    const { service, prisma } = createService();

    const result = await service.createStaffInvite({
      companyId: company.id,
      branchId: branch.id,
      staffUserId: staffUser.id,
      email: "Owner@Test.Local",
      name: "Owner",
      role: StaffRole.owner,
      createdByPlatformAdminId: "platform-admin-1",
    });

    expect(result.inviteToken).toMatch(/^balcona_staff_invite_/);
    expect(result.invitePath).toBe(
      `/staff/invite/${encodeURIComponent(result.inviteToken)}`,
    );
    expect(prisma.staffInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: company.id,
          status: StaffInviteStatus.pending,
        }),
        data: expect.objectContaining({
          status: StaffInviteStatus.revoked,
        }),
      }),
    );
    expect(prisma.staffInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "owner@test.local",
          tokenHash: expect.any(String),
        }),
      }),
    );
    expect(prisma.platformAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "staff_invite_created",
          targetType: "staff_invite",
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("tokenHash");
  });

  it("accepts a pending invite, sets the staff password, and revokes old pending invites", async () => {
    const token = "balcona_staff_invite_known";
    const { service, prisma, auditService } = createService();
    const pendingInvite = invite({ token });

    prisma.staffInvite.findUnique.mockResolvedValue(pendingInvite);
    prisma.staffUser.update.mockResolvedValue({
      ...staffUser,
      passwordSetAt: now,
    });
    prisma.staffInvite.update.mockResolvedValue({
      ...pendingInvite,
      status: StaffInviteStatus.accepted,
      acceptedAt: now,
    });

    const result = await service.acceptInvite(token, {
      password: "StrongPassword123!",
    });
    const staffUserUpdate = prisma.staffUser.update.mock.calls[0][0];

    expect(
      await bcrypt.compare(
        "StrongPassword123!",
        staffUserUpdate.data.passwordHash,
      ),
    ).toBe(true);
    expect(staffUserUpdate.data.passwordSetAt).toBeInstanceOf(Date);
    expect(prisma.staffInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pendingInvite.id },
        data: expect.objectContaining({
          status: StaffInviteStatus.accepted,
        }),
      }),
    );
    expect(prisma.staffInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: pendingInvite.id },
          status: StaffInviteStatus.pending,
        }),
        data: expect.objectContaining({
          status: StaffInviteStatus.revoked,
        }),
      }),
    );
    expect(auditService.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "staff_invite_accepted",
        actorStaffUserId: staffUser.id,
      }),
      prisma,
    );
    expect(result.staffUser.passwordSetAt).toBe(now);
    expect(JSON.stringify(result)).not.toContain("tokenHash");
  });

  it("marks an expired pending invite and rejects password setup", async () => {
    const token = "balcona_staff_invite_expired";
    const { service, prisma } = createService();
    const expiredInvite = invite({
      token,
      inviteExpiresAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    prisma.staffInvite.findUnique.mockResolvedValue(expiredInvite);
    prisma.staffInvite.update.mockResolvedValue({
      ...expiredInvite,
      status: StaffInviteStatus.expired,
    });

    await expect(
      service.acceptInvite(token, { password: "StrongPassword123!" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.staffInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: StaffInviteStatus.expired },
      }),
    );
    expect(prisma.staffUser.update).not.toHaveBeenCalled();
  });

  it("rejects already accepted invites with readable errors", async () => {
    const token = "balcona_staff_invite_accepted";
    const { service, prisma } = createService();

    prisma.staffInvite.findUnique.mockResolvedValue(
      invite({ token, status: StaffInviteStatus.accepted }),
    );

    await expect(
      service.acceptInvite(token, { password: "StrongPassword123!" }),
    ).rejects.toThrow("Staff invite has already been accepted");
    expect(prisma.staffUser.update).not.toHaveBeenCalled();
  });
});
