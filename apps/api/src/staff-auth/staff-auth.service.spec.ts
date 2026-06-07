import { ForbiddenException } from "@nestjs/common";
import {
  BranchStatus,
  CompanyStatus,
  StaffRole,
  StaffSessionStatus,
  StaffStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { StaffAuthService } from "./staff-auth.service";

function createService({
  environment = "staging",
  devBootstrapEnabled = false,
}: {
  environment?: string;
  devBootstrapEnabled?: boolean;
} = {}) {
  const prisma = {
    staffUser: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    staffSession: {
      create: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key === "app.environment") {
        return environment;
      }

      if (key === "staffAuth.devBootstrapEnabled") {
        return devBootstrapEnabled;
      }

      return defaultValue;
    }),
  };
  const staffAccessService = {
    getAccess: jest.fn().mockResolvedValue({
      memberships: [],
      effectiveAccess: {
        permissions: [],
        companies: [],
        branches: [],
      },
    }),
  };
  const auditService = {
    recordAuditLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
  };

  return {
    prisma,
    staffAccessService,
    auditService,
    service: new StaffAuthService(
      prisma as never,
      configService as never,
      staffAccessService as never,
      auditService as never,
    ),
  };
}

describe("StaffAuthService", () => {
  it("blocks staff password bootstrap in staging unless explicitly enabled", async () => {
    const { prisma, service } = createService();

    await expect(
      service.bootstrapPassword({
        email: "owner@example.com",
        password: "StrongPassword123!",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.staffUser.findUnique).not.toHaveBeenCalled();
  });

  it("logs in staff after invite acceptance has set the password hash", async () => {
    const { prisma, service, staffAccessService, auditService } = createService({
      environment: "staging",
    });
    const passwordHash = await bcrypt.hash("StrongPassword123!", 12);
    const now = new Date("2026-06-07T10:00:00.000Z");
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
      passwordHash,
      passwordSetAt: now,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      memberships: [
        {
          id: "membership-1",
          companyId: company.id,
          branchId: branch.id,
          role: StaffRole.owner,
          status: StaffStatus.active,
          company,
          branch,
        },
      ],
    };

    prisma.staffUser.findUnique.mockResolvedValue(staffUser);
    prisma.staffSession.create.mockResolvedValue({
      id: "session-1",
      companyId: company.id,
      branchId: branch.id,
      staffUserId: staffUser.id,
      status: StaffSessionStatus.active,
      expiresAt: new Date("2026-06-07T22:00:00.000Z"),
      revokedAt: null,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.login({
      email: "Owner@Test.Local",
      password: "StrongPassword123!",
    });

    expect(result.accessToken).toMatch(/^balcona_staff_/);
    expect(prisma.staffSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: company.id,
          branchId: branch.id,
          staffUserId: staffUser.id,
          tokenHash: expect.any(String),
        }),
      }),
    );
    expect(prisma.staffUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: staffUser.id },
        data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      }),
    );
    expect(auditService.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "staff_login",
        actorStaffUserId: staffUser.id,
      }),
    );
    expect(staffAccessService.getAccess).toHaveBeenCalledWith(staffUser.id);
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });
});
