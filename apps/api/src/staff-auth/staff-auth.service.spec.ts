import { ForbiddenException } from "@nestjs/common";
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

  return {
    prisma,
    service: new StaffAuthService(
      prisma as never,
      configService as never,
      {} as never,
      {} as never,
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
});
