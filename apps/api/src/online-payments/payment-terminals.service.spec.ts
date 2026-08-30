import {
  BillStatus,
  PaymentTerminalEnvironment,
  PaymentTerminalProvider,
  PaymentTerminalStatus,
  TerminalPaymentRequestStatus,
} from "@prisma/client";
import { PaymentTerminalsService } from "./payment-terminals.service";

function terminal() {
  return {
    id: "terminal-1",
    companyId: "company-1",
    branchId: "branch-1",
    provider: PaymentTerminalProvider.paymob,
    environment: PaymentTerminalEnvironment.test,
    status: PaymentTerminalStatus.blocked,
    displayName: "Counter terminal",
    providerTerminalReference: "provider-terminal-1",
    deviceReference: null,
    merchantReference: "merchant-1",
    secretReference: "TERMINAL_PROVIDER_SECRET",
    capabilities: null,
    readinessMessage: "Provider execution blocked",
    lastSeenAt: null,
    liveVerifiedAt: null,
    createdAt: new Date("2026-08-30T12:00:00.000Z"),
    updatedAt: new Date("2026-08-30T12:00:00.000Z"),
  };
}

function setup() {
  const paymentTerminal = terminal();
  const prisma = {
    branch: {
      findUnique: jest.fn().mockResolvedValue({
        id: "branch-1",
        companyId: "company-1",
        name: "Downtown",
        slug: "downtown",
        status: "active",
      }),
    },
    bill: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentTerminal: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(paymentTerminal),
      create: jest.fn().mockResolvedValue(paymentTerminal),
      update: jest.fn().mockResolvedValue(paymentTerminal),
    },
    terminalPaymentRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  };
  const auditService = {
    recordAuditLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
  };
  const service = new PaymentTerminalsService(
    prisma as never,
    auditService as never,
  );

  return { service, prisma, auditService, paymentTerminal };
}

describe("PaymentTerminalsService", () => {
  it("rejects credential values and accepts only runtime secret references", async () => {
    const { service, prisma } = setup();

    await expect(
      service.upsertForBranch("branch-1", "staff-1", {
        provider: PaymentTerminalProvider.paymob,
        environment: PaymentTerminalEnvironment.test,
        displayName: "Counter terminal",
        secretReference: "this-looks-like-a-secret-value",
      }),
    ).rejects.toThrow(
      "Terminal secretReference must be a runtime secret name, not a credential value",
    );

    expect(prisma.paymentTerminal.create).not.toHaveBeenCalled();
    expect(prisma.paymentTerminal.update).not.toHaveBeenCalled();
  });

  it("refuses terminal collection while an online payment is unresolved", async () => {
    const { service, prisma } = setup();
    prisma.bill.findUnique.mockResolvedValueOnce({
      id: "bill-1",
      companyId: "company-1",
      branchId: "branch-1",
      status: BillStatus.payment_pending,
      balanceDueMinor: 12500,
      currency: "EGP",
      onlinePaymentIntents: [{ id: "intent-1" }],
    });

    await expect(
      service.startForBill("bill-1", "staff-1", {
        terminalId: "terminal-1",
        idempotencyKey: "terminal-request-key-1",
      }),
    ).rejects.toThrow(
      "An online payment is still unresolved. Resolve it before starting terminal payment.",
    );

    expect(prisma.paymentTerminal.findUnique).not.toHaveBeenCalled();
    expect(prisma.terminalPaymentRequest.create).not.toHaveBeenCalled();
    expect(prisma.bill.update).not.toHaveBeenCalled();
    expect(prisma.bill.updateMany).not.toHaveBeenCalled();
  });

  it("records a blocked request without sending provider mutation or settling the bill", async () => {
    const { service, prisma, auditService, paymentTerminal } = setup();
    prisma.bill.findUnique.mockResolvedValueOnce({
      id: "bill-1",
      companyId: "company-1",
      branchId: "branch-1",
      status: BillStatus.presented,
      balanceDueMinor: 12500,
      currency: "EGP",
      onlinePaymentIntents: [],
    });

    const request = {
      id: "terminal-request-1",
      companyId: "company-1",
      branchId: "branch-1",
      billId: "bill-1",
      paymentTerminalId: "terminal-1",
      requestedByStaffUserId: "staff-1",
      idempotencyKey: "terminal-request-key-1",
      status: TerminalPaymentRequestStatus.blocked,
      amountMinor: 12500,
      currency: "EGP",
      providerRequestReference: null,
      providerTransactionReference: null,
      failureCode: "terminal_provider_contract_unavailable",
      failureMessage: "Provider execution blocked",
      requestedAt: new Date("2026-08-30T12:05:00.000Z"),
      sentAt: null,
      approvedAt: null,
      declinedAt: null,
      cancelledAt: null,
      timedOutAt: null,
      metadata: null,
      createdAt: new Date("2026-08-30T12:05:00.000Z"),
      updatedAt: new Date("2026-08-30T12:05:00.000Z"),
      terminal: paymentTerminal,
      bill: {
        id: "bill-1",
        status: BillStatus.presented,
        balanceDueMinor: 12500,
        currency: "EGP",
      },
    };
    prisma.terminalPaymentRequest.create.mockResolvedValueOnce(request);

    const result = await service.startForBill("bill-1", "staff-1", {
      terminalId: "terminal-1",
      idempotencyKey: "terminal-request-key-1",
    });

    expect(prisma.terminalPaymentRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: TerminalPaymentRequestStatus.blocked,
          amountMinor: 12500,
          currency: "EGP",
          failureCode: "terminal_provider_contract_unavailable",
        }),
      }),
    );
    expect(prisma.bill.update).not.toHaveBeenCalled();
    expect(prisma.bill.updateMany).not.toHaveBeenCalled();
    expect(auditService.recordAuditLog).toHaveBeenCalled();
    expect(result).toMatchObject({
      providerMutationSent: false,
      billSettled: false,
      request: {
        id: "terminal-request-1",
        status: TerminalPaymentRequestStatus.blocked,
      },
    });
  });
});
