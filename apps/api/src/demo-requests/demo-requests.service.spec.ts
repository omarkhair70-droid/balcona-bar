import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DemoRequestsService } from "./demo-requests.service";

describe("DemoRequestsService", () => {
  const prisma = {
    demoRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new DemoRequestsService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it("persists an approved public request without the honeypot field", async () => {
    prisma.demoRequest.create.mockResolvedValue({ id: "lead-1", status: "new" });

    await service.create({
      fullName: "Omar Khair",
      businessName: "Balcona Cafe",
      email: "omar@example.com",
      locationCount: 2,
      consent: true,
      website: "",
    });

    expect(prisma.demoRequest.create).toHaveBeenCalledWith({
      data: {
        fullName: "Omar Khair",
        businessName: "Balcona Cafe",
        email: "omar@example.com",
        locationCount: 2,
        consent: true,
      },
      select: { id: true, status: true, createdAt: true },
    });
  });

  it("rejects a request without contact consent", () => {
    expect(() =>
      service.create({
        fullName: "Omar Khair",
        businessName: "Balcona Cafe",
        email: "omar@example.com",
        locationCount: 1,
        consent: false,
      }),
    ).toThrow(BadRequestException);
  });

  it("does not silently update a missing lead", async () => {
    prisma.demoRequest.findUnique.mockResolvedValue(null);

    await expect(service.update("missing", { status: "closed" })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.demoRequest.update).not.toHaveBeenCalled();
  });
});
