import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { BootstrapPlatformCompanyDto } from "./bootstrap-platform-company.dto";

const validBootstrapInput = {
  company: {
    name: "Test Cafe",
    slug: "test-cafe",
  },
  owner: {
    name: "Owner",
    email: "owner@test.local",
  },
  branch: {
    name: "Main",
    slug: "main",
    address: "1 Test Street",
  },
  subscription: {
    planCode: "starter",
    status: "trialing",
  },
  starterTables: {
    enabled: true,
    floorLabel: "Ground Floor",
    tablePrefix: "T",
    startNumber: 1,
    count: 2,
    seats: 4,
  },
};

describe("BootstrapPlatformCompanyDto", () => {
  it("allows trialing and active bootstrap subscription statuses", async () => {
    for (const status of ["trialing", "active"]) {
      const dto = plainToInstance(BootstrapPlatformCompanyDto, {
        ...validBootstrapInput,
        subscription: {
          ...validBootstrapInput.subscription,
          status,
        },
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it("rejects blocking subscription statuses during initial bootstrap", async () => {
    const dto = plainToInstance(BootstrapPlatformCompanyDto, {
      ...validBootstrapInput,
      subscription: {
        ...validBootstrapInput.subscription,
        status: "suspended",
      },
    });
    const errors = await validate(dto);

    expect(JSON.stringify(errors)).toContain("status");
  });
});
