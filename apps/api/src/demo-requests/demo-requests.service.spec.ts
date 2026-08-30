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
    platformAuditEvent: {
      create: jest.fn(),
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

  it("attributes internal follow-up changes to the platform admin", async () => {
    const updatedAt = new Date("2026-08-30T10:00:00.000Z");
    prisma.demoRequest.findUnique.mockResolvedValue({ id: "lead-1" });
    prisma.demoRequest.update.mockResolvedValue({
      id: "lead-1",
      status: "contacted",
      lastContactedAt: updatedAt,
    });

    const result = await service.update(
      "lead-1",
      {
        status: "contacted",
        internalNotes: "Follow up tomorrow",
        lastContactedAt: updatedAt.toISOString(),
      },
      "platform-admin-1",
    );

    expect(result.status).toBe("contacted");
    expect(prisma.platformAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        platformAdminUserId: "platform-admin-1",
        action: "demo_request_updated",
        targetType: "demo_request",
        targetId: "lead-1",
        metadata: expect.objectContaining({
          status: "contacted",
          lastContactedAt: updatedAt.toISOString(),
          notesUpdated: true,
        }),
      }),
    });
  });

  it("does not silently update a missing lead", async () => {
    prisma.demoRequest.findUnique.mockResolvedValue(null);

    await expect(service.update("missing", { status: "closed" })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.demoRequest.update).not.toHaveBeenCalled();
  });
});
