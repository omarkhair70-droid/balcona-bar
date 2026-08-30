import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditAction,
  AuditActorType,
  BillStatus,
  PaymentTerminalStatus,
  Prisma,
  TerminalPaymentRequestStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  StartTerminalPaymentRequestDto,
  UpsertPaymentTerminalDto,
} from "./dto/payment-terminal.dto";

const PAYABLE_BILL_STATUSES = [
  BillStatus.presented,
  BillStatus.payment_pending,
] as const;

@Injectable()
export class PaymentTerminalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listForBranch(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, companyId: true, name: true, slug: true, status: true },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const terminals = await this.prisma.paymentTerminal.findMany({
      where: { branchId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return {
      branch,
      execution: {
        available: false,
        blockerCode: "terminal_provider_contract_unavailable",
        message:
          "Direct terminal/SoftPOS provider execution is not connected. card_pos remains an external manual tender record only.",
      },
      terminals: terminals.map((terminal) => this.publicTerminal(terminal)),
    };
  }

  async listRequestsForBranch(branchId: string, limit = 50) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, companyId: true, name: true, slug: true, status: true },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const requests = await this.prisma.terminalPaymentRequest.findMany({
      where: { branchId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        terminal: true,
        bill: {
          select: {
            id: true,
            billNumber: true,
            status: true,
            totalMinor: true,
            paidMinor: true,
            balanceDueMinor: true,
            currency: true,
          },
        },
      },
    });

    return {
      branch,
      requests: requests.map((request) => ({
        id: request.id,
        bill: request.bill,
        terminal: this.publicTerminal(request.terminal),
        status: request.status,
        amountMinor: request.amountMinor,
        currency: request.currency,
        providerRequestReference: request.providerRequestReference,
        providerTransactionReference: request.providerTransactionReference,
        failureCode: request.failureCode,
        failureMessage: request.failureMessage,
        requestedByStaffUserId: request.requestedByStaffUserId,
        requestedAt: request.requestedAt,
        sentAt: request.sentAt,
        approvedAt: request.approvedAt,
        declinedAt: request.declinedAt,
        cancelledAt: request.cancelledAt,
        timedOutAt: request.timedOutAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      })),
    };
  }

  async upsertForBranch(
    branchId: string,
    staffUserId: string,
    input: UpsertPaymentTerminalDto,
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, companyId: true },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const secretReference = this.normalizeSecretReference(input.secretReference);
    const providerTerminalReference = this.optionalText(
      input.providerTerminalReference,
    );
    const existing = providerTerminalReference
      ? await this.prisma.paymentTerminal.findFirst({
          where: {
            branchId,
            provider: input.provider,
            providerTerminalReference,
          },
        })
      : null;

    const readinessMessage =
      "Terminal metadata is saved, but direct provider execution remains blocked until an exact merchant terminal/SoftPOS API contract and test device are verified.";

    const terminal = existing
      ? await this.prisma.paymentTerminal.update({
          where: { id: existing.id },
          data: {
            environment: input.environment,
            status: PaymentTerminalStatus.blocked,
            displayName: input.displayName.trim(),
            deviceReference: this.optionalText(input.deviceReference),
            merchantReference: this.optionalText(input.merchantReference),
            secretReference,
            readinessMessage,
            liveVerifiedAt: null,
          },
        })
      : await this.prisma.paymentTerminal.create({
          data: {
            companyId: branch.companyId,
            branchId,
            provider: input.provider,
            environment: input.environment,
            status: PaymentTerminalStatus.blocked,
            displayName: input.displayName.trim(),
            providerTerminalReference,
            deviceReference: this.optionalText(input.deviceReference),
            merchantReference: this.optionalText(input.merchantReference),
            secretReference,
            readinessMessage,
          },
        });

    await this.auditService.recordAuditLog({
      companyId: branch.companyId,
      branchId,
      actorType: AuditActorType.staff,
      actorStaffUserId: staffUserId,
      targetType: "payment_terminal",
      targetId: terminal.id,
      action: AuditAction.other,
      message: "Payment terminal configuration saved in fail-closed state",
      metadata: {
        provider: terminal.provider,
        environment: terminal.environment,
        providerTerminalReference: terminal.providerTerminalReference,
        hasSecretReference: Boolean(terminal.secretReference),
        executionAvailable: false,
      },
    });

    return {
      terminal: this.publicTerminal(terminal),
      execution: {
        available: false,
        blockerCode: "terminal_provider_contract_unavailable",
        message: readinessMessage,
      },
    };
  }

  async startForBill(
    billId: string,
    staffUserId: string,
    input: StartTerminalPaymentRequestDto,
  ) {
    const existingByKey = await this.prisma.terminalPaymentRequest.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { terminal: true, bill: true },
    });
    if (existingByKey) {
      if (
        existingByKey.billId !== billId ||
        existingByKey.requestedByStaffUserId !== staffUserId
      ) {
        throw new BadRequestException(
          "Terminal payment idempotency key belongs to another request",
        );
      }
      return this.publicBlockedRequest(existingByKey);
    }

    const bill = await this.prisma.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        status: true,
        balanceDueMinor: true,
        currency: true,
        onlinePaymentIntents: {
          where: { status: { in: ["pending", "requires_action"] } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!bill) {
      throw new NotFoundException("Bill not found");
    }
    if (!PAYABLE_BILL_STATUSES.includes(bill.status as (typeof PAYABLE_BILL_STATUSES)[number])) {
      throw new BadRequestException(
        "Only presented or payment-pending bills can start terminal payment",
      );
    }
    if (bill.balanceDueMinor <= 0) {
      throw new BadRequestException("Bill has no balance due");
    }
    if (bill.onlinePaymentIntents.length > 0) {
      throw new BadRequestException(
        "An online payment is still unresolved. Resolve it before starting terminal payment.",
      );
    }

    const terminal = await this.prisma.paymentTerminal.findUnique({
      where: { id: input.terminalId },
    });
    if (!terminal || terminal.branchId !== bill.branchId) {
      throw new NotFoundException("Payment terminal not found for this branch");
    }

    const failureMessage =
      "Direct terminal/SoftPOS execution is blocked until the provider-specific merchant contract, callbacks/inquiry behavior, and test device are verified.";

    const request = await this.prisma.terminalPaymentRequest.create({
      data: {
        companyId: bill.companyId,
        branchId: bill.branchId,
        billId: bill.id,
        paymentTerminalId: terminal.id,
        requestedByStaffUserId: staffUserId,
        idempotencyKey: input.idempotencyKey,
        status: TerminalPaymentRequestStatus.blocked,
        amountMinor: bill.balanceDueMinor,
        currency: bill.currency,
        failureCode: "terminal_provider_contract_unavailable",
        failureMessage,
        metadata: {
          provider: terminal.provider,
          environment: terminal.environment,
          note:
            "No provider request was sent and no bill/payment state was changed.",
        } satisfies Prisma.InputJsonObject,
      },
      include: { terminal: true, bill: true },
    });

    await this.auditService.recordAuditLog({
      companyId: bill.companyId,
      branchId: bill.branchId,
      actorType: AuditActorType.staff,
      actorStaffUserId: staffUserId,
      targetType: "terminal_payment_request",
      targetId: request.id,
      action: AuditAction.other,
      message: "Direct terminal payment request blocked before provider mutation",
      metadata: {
        billId,
        terminalId: terminal.id,
        provider: terminal.provider,
        amountMinor: bill.balanceDueMinor,
        currency: bill.currency,
        blockerCode: request.failureCode,
      },
    });

    return this.publicBlockedRequest(request);
  }

  private publicTerminal(terminal: {
    id: string;
    companyId: string;
    branchId: string;
    provider: string;
    environment: string;
    status: string;
    displayName: string;
    providerTerminalReference: string | null;
    deviceReference: string | null;
    merchantReference: string | null;
    secretReference: string | null;
    capabilities: Prisma.JsonValue | null;
    readinessMessage: string | null;
    lastSeenAt: Date | null;
    liveVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: terminal.id,
      companyId: terminal.companyId,
      branchId: terminal.branchId,
      provider: terminal.provider,
      environment: terminal.environment,
      status: terminal.status,
      displayName: terminal.displayName,
      providerTerminalReference: terminal.providerTerminalReference,
      deviceReference: terminal.deviceReference,
      merchantReference: terminal.merchantReference,
      secretReference: terminal.secretReference,
      capabilities: terminal.capabilities,
      readinessMessage: terminal.readinessMessage,
      lastSeenAt: terminal.lastSeenAt,
      liveVerifiedAt: terminal.liveVerifiedAt,
      createdAt: terminal.createdAt,
      updatedAt: terminal.updatedAt,
      executionAvailable: false,
    };
  }

  private publicBlockedRequest(request: {
    id: string;
    billId: string;
    status: string;
    amountMinor: number;
    currency: string;
    failureCode: string | null;
    failureMessage: string | null;
    requestedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    terminal: Parameters<PaymentTerminalsService["publicTerminal"]>[0];
  }) {
    return {
      request: {
        id: request.id,
        billId: request.billId,
        status: request.status,
        amountMinor: request.amountMinor,
        currency: request.currency,
        failureCode: request.failureCode,
        failureMessage: request.failureMessage,
        requestedAt: request.requestedAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        terminal: this.publicTerminal(request.terminal),
      },
      providerMutationSent: false,
      billSettled: false,
    };
  }

  private optionalText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeSecretReference(value?: string | null) {
    const normalized = this.optionalText(value);
    if (!normalized) {
      return null;
    }
    if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(normalized)) {
      throw new BadRequestException(
        "Terminal secretReference must be a runtime secret name, not a credential value",
      );
    }
    return normalized;
  }
}
