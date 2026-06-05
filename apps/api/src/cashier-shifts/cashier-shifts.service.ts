import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillPaymentMethod,
  CashDrawerTransactionSourceType,
  CashDrawerTransactionType,
  CashierShiftReportType,
  CashierShiftStatus,
  ManualPaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BranchCashierShiftsQueryDto } from './dto/branch-cashier-shifts-query.dto';
import { CloseCashierShiftDto } from './dto/close-cashier-shift.dto';
import { CreateCashAdjustmentDto } from './dto/create-cash-adjustment.dto';
import { OpenCashierShiftDto } from './dto/open-cashier-shift.dto';

const DEFAULT_SHIFT_LIMIT = 20;
const DEFAULT_SHIFT_CURRENCY = 'EGP';
const X_REPORT_PREFIX = 'X-';
const Z_REPORT_PREFIX = 'Z-';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

type OpenShiftForPayment = {
  id: string;
  companyId: string;
  branchId: string;
  currency: string;
};

type ManualPaymentShiftInput = {
  shift: OpenShiftForPayment;
  paymentId: string;
  method: BillPaymentMethod;
  amountMinor: number;
  currency: string;
  staffUserId: string;
  note?: string | null;
};

@Injectable()
export class CashierShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(branchId: string) {
    const branch = await this.findBranch(branchId, this.prisma);
    const shift = await this.prisma.cashierShift.findFirst({
      where: { branchId, status: CashierShiftStatus.open },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      include: this.shiftStaffInclude(),
    });

    if (!shift) {
      return {
        branch,
        shift: null,
        summary: null,
      };
    }

    const detail = await this.findOne(shift.id);

    return {
      branch,
      shift: detail.shift,
      summary: detail.summary,
    };
  }

  async open(branchId: string, body: OpenCashierShiftDto, staffUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(staffUserId, tx);
      const branch = await this.findBranch(branchId, tx);
      await this.lockBranchShift(branchId, tx);

      const existingOpenShift = await tx.cashierShift.findFirst({
        where: { branchId, status: CashierShiftStatus.open },
        select: { id: true },
      });

      if (existingOpenShift) {
        throw new BadRequestException(
          'A cashier shift is already open for this branch',
        );
      }

      const openingNote = this.normalizeOptionalText(body.note);
      const openedAt = new Date();
      const shift = await tx.cashierShift.create({
        data: {
          companyId: branch.companyId,
          branchId,
          openedByStaffUserId: staffUserId,
          status: CashierShiftStatus.open,
          currency: DEFAULT_SHIFT_CURRENCY,
          openingFloatMinor: body.openingFloatMinor,
          expectedCashMinor: body.openingFloatMinor,
          openedAt,
          openingNote,
        },
        select: { id: true },
      });

      await tx.cashDrawerTransaction.create({
        data: {
          companyId: branch.companyId,
          branchId,
          cashierShiftId: shift.id,
          staffUserId,
          type: CashDrawerTransactionType.opening_float,
          signedAmountMinor: body.openingFloatMinor,
          currency: DEFAULT_SHIFT_CURRENCY,
          sourceType: CashDrawerTransactionSourceType.opening_float,
          sourceId: shift.id,
          note: openingNote,
          createdAt: openedAt,
        },
      });

      await this.refreshCachedShiftTotals(shift.id, tx);

      return this.findOneInternal(shift.id, tx);
    });
  }

  async createCashAdjustment(
    shiftId: string,
    body: CreateCashAdjustmentDto,
    staffUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(staffUserId, tx);
      const shift = await this.findShiftForMutation(shiftId, tx);
      await this.lockBranchShift(shift.branchId, tx);
      const lockedShift = await this.findShiftForMutation(shiftId, tx);

      if (lockedShift.status !== CashierShiftStatus.open) {
        throw new BadRequestException(
          'Closed cashier shifts cannot be adjusted',
        );
      }

      const note = this.normalizeOptionalText(body.note);

      if (!note) {
        throw new BadRequestException(
          'Cash drawer adjustment note is required',
        );
      }

      const signedAmountMinor = this.toSignedAdjustmentAmount(body);

      await tx.cashDrawerTransaction.create({
        data: {
          companyId: lockedShift.companyId,
          branchId: lockedShift.branchId,
          cashierShiftId: lockedShift.id,
          staffUserId,
          type: body.type as CashDrawerTransactionType,
          signedAmountMinor,
          currency: lockedShift.currency,
          sourceType: CashDrawerTransactionSourceType.adjustment,
          sourceId: lockedShift.id,
          note,
        },
      });

      await this.refreshCachedShiftTotals(lockedShift.id, tx);

      return this.findOneInternal(lockedShift.id, tx);
    });
  }

  async generateXReport(shiftId: string, staffUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(staffUserId, tx);
      const shift = await this.findShiftForMutation(shiftId, tx);

      if (shift.status !== CashierShiftStatus.open) {
        throw new BadRequestException(
          'X reports can only be generated for an open cashier shift',
        );
      }

      const reportNumber = await this.generateReportNumber(
        shift.branchId,
        CashierShiftReportType.x_report,
        tx,
      );
      const snapshot = await this.buildReportSnapshot(
        shift.id,
        CashierShiftReportType.x_report,
        tx,
      );
      const report = await tx.cashierShiftReport.create({
        data: {
          companyId: shift.companyId,
          branchId: shift.branchId,
          cashierShiftId: shift.id,
          generatedByStaffUserId: staffUserId,
          type: CashierShiftReportType.x_report,
          reportNumber,
          snapshot: this.toJsonValue({
            ...snapshot,
            reportNumber,
          }),
        },
      });

      return {
        shift,
        report,
        snapshot: report.snapshot,
      };
    });
  }

  async close(
    shiftId: string,
    body: CloseCashierShiftDto,
    staffUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(staffUserId, tx);
      const shift = await this.findShiftForMutation(shiftId, tx);
      await this.lockBranchShift(shift.branchId, tx);
      const lockedShift = await this.findShiftForMutation(shiftId, tx);

      if (lockedShift.status !== CashierShiftStatus.open) {
        throw new BadRequestException('Cashier shift is already closed');
      }

      const closedAt = new Date();
      const closingNote = this.normalizeOptionalText(body.note);
      const reportNumber = await this.generateReportNumber(
        lockedShift.branchId,
        CashierShiftReportType.z_report,
        tx,
      );
      const snapshot = await this.buildReportSnapshot(
        lockedShift.id,
        CashierShiftReportType.z_report,
        tx,
        {
          countedCashMinor: body.countedCashMinor,
          closedAt,
          closedByStaffUserId: staffUserId,
          closingNote,
          reportNumber,
        },
      );

      await tx.cashierShiftReport.create({
        data: {
          companyId: lockedShift.companyId,
          branchId: lockedShift.branchId,
          cashierShiftId: lockedShift.id,
          generatedByStaffUserId: staffUserId,
          type: CashierShiftReportType.z_report,
          reportNumber,
          snapshot: this.toJsonValue(snapshot),
          generatedAt: closedAt,
        },
      });

      await tx.cashierShift.update({
        where: { id: lockedShift.id },
        data: {
          status: CashierShiftStatus.closed,
          closedByStaffUserId: staffUserId,
          closedAt,
          closingNote,
          countedCashMinor: body.countedCashMinor,
          cashOverShortMinor: snapshot.cashDrawer.cashOverShortMinor,
          expectedCashMinor: snapshot.cashDrawer.expectedCashMinor,
          cashSalesMinor: snapshot.tenderTotals.cashMinor,
          cardSalesMinor: snapshot.tenderTotals.cardPosMinor,
          walletSalesMinor: snapshot.tenderTotals.walletManualMinor,
          otherSalesMinor: snapshot.tenderTotals.otherMinor,
          paymentCount: snapshot.counts.paymentCount,
          billCount: snapshot.counts.billCount,
          zReportNumber: reportNumber,
          zReportSnapshot: this.toJsonValue(snapshot),
        },
      });

      return this.findOneInternal(lockedShift.id, tx);
    });
  }

  async findForBranch(
    branchId: string,
    query: BranchCashierShiftsQueryDto = {},
  ) {
    const branch = await this.findBranch(branchId, this.prisma);
    const status = query.status ?? 'all';
    const shifts = await this.prisma.cashierShift.findMany({
      where: {
        branchId,
        ...(status === 'all' ? {} : { status: status as CashierShiftStatus }),
      },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      take: this.normalizeLimit(query.limit),
      include: this.shiftStaffInclude(),
    });

    return {
      branch,
      filters: {
        status,
        limit: this.normalizeLimit(query.limit),
      },
      shifts,
    };
  }

  async findOne(shiftId: string) {
    return this.findOneInternal(shiftId, this.prisma);
  }

  async getOpenShiftForPayment(
    branchId: string,
    currency: string,
    tx: Prisma.TransactionClient,
  ): Promise<OpenShiftForPayment> {
    await this.lockBranchShift(branchId, tx);

    const shift = await tx.cashierShift.findFirst({
      where: {
        branchId,
        status: CashierShiftStatus.open,
      },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        companyId: true,
        branchId: true,
        currency: true,
      },
    });

    if (!shift) {
      throw new BadRequestException(
        'Open a cashier shift before recording payments',
      );
    }

    if (shift.currency !== currency) {
      throw new BadRequestException(
        'Open cashier shift currency does not match the bill currency',
      );
    }

    return shift;
  }

  async recordManualPaymentOnShift(
    input: ManualPaymentShiftInput,
    tx: Prisma.TransactionClient,
  ) {
    const data: Prisma.CashierShiftUpdateInput = {
      paymentCount: { increment: 1 },
      billCount: { increment: 1 },
    };

    if (input.method === BillPaymentMethod.cash) {
      data.cashSalesMinor = { increment: input.amountMinor };
      data.expectedCashMinor = { increment: input.amountMinor };

      await tx.cashDrawerTransaction.create({
        data: {
          companyId: input.shift.companyId,
          branchId: input.shift.branchId,
          cashierShiftId: input.shift.id,
          staffUserId: input.staffUserId,
          type: CashDrawerTransactionType.cash_payment,
          signedAmountMinor: input.amountMinor,
          currency: input.currency,
          sourceType: CashDrawerTransactionSourceType.manual_payment,
          sourceId: input.paymentId,
          note: input.note ?? null,
        },
      });
    } else if (input.method === BillPaymentMethod.card_pos) {
      data.cardSalesMinor = { increment: input.amountMinor };
    } else if (input.method === BillPaymentMethod.wallet_manual) {
      data.walletSalesMinor = { increment: input.amountMinor };
    } else {
      data.otherSalesMinor = { increment: input.amountMinor };
    }

    await tx.cashierShift.update({
      where: { id: input.shift.id },
      data,
    });
  }

  private async findOneInternal(shiftId: string, tx: PrismaExecutor) {
    const shift = await tx.cashierShift.findUnique({
      where: { id: shiftId },
      include: {
        company: { select: this.companySelect() },
        branch: { select: this.branchSelect() },
        ...this.shiftStaffInclude(),
      },
    });

    if (!shift) {
      throw new NotFoundException('Cashier shift not found');
    }

    const drawerTransactions = await tx.cashDrawerTransaction.findMany({
      where: { cashierShiftId: shift.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const reports = await tx.cashierShiftReport.findMany({
      where: { cashierShiftId: shift.id },
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
    });
    const summary =
      shift.status === CashierShiftStatus.closed && shift.zReportSnapshot
        ? shift.zReportSnapshot
        : await this.buildReportSnapshot(
            shift.id,
            CashierShiftReportType.x_report,
            tx,
          );

    return {
      shift,
      company: shift.company,
      branch: shift.branch,
      drawerTransactions,
      reports,
      summary,
    };
  }

  private async buildReportSnapshot(
    shiftId: string,
    reportType: CashierShiftReportType,
    tx: PrismaExecutor,
    closeContext: {
      countedCashMinor?: number;
      closedAt?: Date;
      closedByStaffUserId?: string;
      closingNote?: string | null;
      reportNumber?: string;
    } = {},
  ) {
    const shift = await tx.cashierShift.findUnique({
      where: { id: shiftId },
      include: {
        company: { select: this.companySelect() },
        branch: { select: this.branchSelect() },
        openedByStaffUser: { select: this.staffSelect() },
        closedByStaffUser: { select: this.staffSelect() },
      },
    });

    if (!shift) {
      throw new NotFoundException('Cashier shift not found');
    }

    const [manualPayments, drawerTransactions] = await Promise.all([
      tx.manualPayment.findMany({
        where: {
          cashierShiftId: shift.id,
          status: ManualPaymentStatus.recorded,
        },
        orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
        include: {
          bill: {
            select: {
              id: true,
              billNumber: true,
              status: true,
              totalMinor: true,
              paidMinor: true,
              balanceDueMinor: true,
              paidAt: true,
            },
          },
          recordedByStaffUser: { select: this.staffSelect() },
        },
      }),
      tx.cashDrawerTransaction.findMany({
        where: { cashierShiftId: shift.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const cashPaymentMinor = this.sumPaymentsByMethod(
      manualPayments,
      BillPaymentMethod.cash,
    );
    const cardPosMinor = this.sumPaymentsByMethod(
      manualPayments,
      BillPaymentMethod.card_pos,
    );
    const walletManualMinor = this.sumPaymentsByMethod(
      manualPayments,
      BillPaymentMethod.wallet_manual,
    );
    const otherMinor = this.sumPaymentsByMethod(
      manualPayments,
      BillPaymentMethod.other,
    );
    const cashInMinor = this.sumDrawerTransactions(
      drawerTransactions,
      CashDrawerTransactionType.cash_in,
    );
    const cashOutMinor = Math.abs(
      this.sumDrawerTransactions(
        drawerTransactions,
        CashDrawerTransactionType.cash_out,
      ),
    );
    const correctionMinor = this.sumDrawerTransactions(
      drawerTransactions,
      CashDrawerTransactionType.correction,
    );
    const expectedCashMinor =
      shift.openingFloatMinor +
      cashPaymentMinor +
      cashInMinor -
      cashOutMinor +
      correctionMinor;
    const countedCashMinor =
      closeContext.countedCashMinor ?? shift.countedCashMinor ?? null;
    const cashOverShortMinor =
      countedCashMinor === null ? null : countedCashMinor - expectedCashMinor;
    const uniqueBillIds = new Set(
      manualPayments.map((payment) => payment.billId),
    );
    const cashPaymentCount = this.countPaymentsByMethod(
      manualPayments,
      BillPaymentMethod.cash,
    );
    const cardPaymentCount = this.countPaymentsByMethod(
      manualPayments,
      BillPaymentMethod.card_pos,
    );
    const walletPaymentCount = this.countPaymentsByMethod(
      manualPayments,
      BillPaymentMethod.wallet_manual,
    );
    const otherPaymentCount = this.countPaymentsByMethod(
      manualPayments,
      BillPaymentMethod.other,
    );

    return {
      reportType,
      reportNumber: closeContext.reportNumber ?? null,
      generatedAt: new Date().toISOString(),
      shift: {
        shiftId: shift.id,
        companyId: shift.companyId,
        branchId: shift.branchId,
        status:
          reportType === CashierShiftReportType.z_report
            ? CashierShiftStatus.closed
            : shift.status,
        currency: shift.currency,
        openedAt: shift.openedAt,
        closedAt: closeContext.closedAt ?? shift.closedAt,
        openedBy: shift.openedByStaffUser,
        closedByStaffUserId:
          closeContext.closedByStaffUserId ?? shift.closedByStaffUserId,
        closedBy: shift.closedByStaffUser,
        openingNote: shift.openingNote,
        closingNote: closeContext.closingNote ?? shift.closingNote,
      },
      company: shift.company,
      branch: shift.branch,
      cashDrawer: {
        openingFloatMinor: shift.openingFloatMinor,
        cashPaymentMinor,
        cashInMinor,
        cashOutMinor,
        correctionMinor,
        expectedCashMinor,
        countedCashMinor:
          reportType === CashierShiftReportType.z_report
            ? countedCashMinor
            : null,
        cashOverShortMinor:
          reportType === CashierShiftReportType.z_report
            ? cashOverShortMinor
            : null,
      },
      tenderTotals: {
        cashMinor: cashPaymentMinor,
        cardPosMinor,
        walletManualMinor,
        otherMinor,
        totalCollectedMinor:
          cashPaymentMinor + cardPosMinor + walletManualMinor + otherMinor,
      },
      counts: {
        billCount: uniqueBillIds.size,
        paymentCount: manualPayments.length,
        cashPaymentCount,
        cardPaymentCount,
        walletPaymentCount,
        otherPaymentCount,
      },
      operational: {
        paidBills: Array.from(uniqueBillIds).map((billId) => {
          const payment = manualPayments.find(
            (candidate) => candidate.billId === billId,
          );

          return payment?.bill ?? { id: billId };
        }),
        manualPayments: manualPayments.map((payment) => ({
          id: payment.id,
          billId: payment.billId,
          method: payment.method,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          reference: payment.reference,
          note: payment.note,
          recordedAt: payment.recordedAt,
          recordedByStaffUser: payment.recordedByStaffUser,
          bill: payment.bill,
        })),
        drawerTransactions,
      },
    };
  }

  private async refreshCachedShiftTotals(
    shiftId: string,
    tx: Prisma.TransactionClient,
  ) {
    const snapshot = await this.buildReportSnapshot(
      shiftId,
      CashierShiftReportType.x_report,
      tx,
    );

    await tx.cashierShift.update({
      where: { id: shiftId },
      data: {
        expectedCashMinor: snapshot.cashDrawer.expectedCashMinor,
        cashSalesMinor: snapshot.tenderTotals.cashMinor,
        cardSalesMinor: snapshot.tenderTotals.cardPosMinor,
        walletSalesMinor: snapshot.tenderTotals.walletManualMinor,
        otherSalesMinor: snapshot.tenderTotals.otherMinor,
        paymentCount: snapshot.counts.paymentCount,
        billCount: snapshot.counts.billCount,
      },
    });
  }

  private async findShiftForMutation(
    shiftId: string,
    tx: Prisma.TransactionClient,
  ) {
    const shift = await tx.cashierShift.findUnique({
      where: { id: shiftId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        status: true,
        currency: true,
      },
    });

    if (!shift) {
      throw new NotFoundException('Cashier shift not found');
    }

    return shift;
  }

  private async findBranch(branchId: string, tx: PrismaExecutor) {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async assertStaffUserExists(
    staffUserId: string | undefined,
    tx: PrismaExecutor,
  ) {
    if (!staffUserId) {
      return;
    }

    const staffUser = await tx.staffUser.findUnique({
      where: { id: staffUserId },
      select: { id: true },
    });

    if (!staffUser) {
      throw new NotFoundException('Staff user not found');
    }
  }

  private async lockBranchShift(
    branchId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cashier-shift:${branchId}`})::bigint)`;
  }

  private async generateReportNumber(
    branchId: string,
    type: CashierShiftReportType,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cashier-report:${branchId}:${type}`})::bigint)`;

    const prefix =
      type === CashierShiftReportType.x_report
        ? X_REPORT_PREFIX
        : Z_REPORT_PREFIX;
    let sequence =
      (await tx.cashierShiftReport.count({ where: { branchId, type } })) + 1;

    while (true) {
      const reportNumber = `${prefix}${String(sequence).padStart(5, '0')}`;
      const existing = await tx.cashierShiftReport.findUnique({
        where: {
          branchId_type_reportNumber: {
            branchId,
            type,
            reportNumber,
          },
        },
        select: { id: true },
      });

      if (!existing) {
        return reportNumber;
      }

      sequence += 1;
    }
  }

  private toSignedAdjustmentAmount(body: CreateCashAdjustmentDto) {
    if (body.type === CashDrawerTransactionType.cash_in) {
      if (body.amountMinor <= 0) {
        throw new BadRequestException('Cash in amount must be positive');
      }

      return body.amountMinor;
    }

    if (body.type === CashDrawerTransactionType.cash_out) {
      if (body.amountMinor <= 0) {
        throw new BadRequestException('Cash out amount must be positive');
      }

      return -body.amountMinor;
    }

    if (body.amountMinor === 0) {
      throw new BadRequestException('Correction amount cannot be zero');
    }

    return body.amountMinor;
  }

  private countPaymentsByMethod(
    payments: { method: BillPaymentMethod }[],
    method: BillPaymentMethod,
  ) {
    return payments.filter((payment) => payment.method === method).length;
  }

  private sumPaymentsByMethod(
    payments: { method: BillPaymentMethod; amountMinor: number }[],
    method: BillPaymentMethod,
  ) {
    return payments
      .filter((payment) => payment.method === method)
      .reduce((sum, payment) => sum + payment.amountMinor, 0);
  }

  private sumDrawerTransactions(
    transactions: {
      type: CashDrawerTransactionType;
      signedAmountMinor: number;
    }[],
    type: CashDrawerTransactionType,
  ) {
    return transactions
      .filter((transaction) => transaction.type === type)
      .reduce((sum, transaction) => sum + transaction.signedAmountMinor, 0);
  }

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? DEFAULT_SHIFT_LIMIT, 1), 100);
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private shiftStaffInclude() {
    return {
      openedByStaffUser: { select: this.staffSelect() },
      closedByStaffUser: { select: this.staffSelect() },
    } satisfies Prisma.CashierShiftInclude;
  }

  private companySelect() {
    return {
      id: true,
      name: true,
      slug: true,
      status: true,
    };
  }

  private branchSelect() {
    return {
      id: true,
      companyId: true,
      name: true,
      slug: true,
      status: true,
    };
  }

  private staffSelect() {
    return {
      id: true,
      email: true,
      name: true,
      status: true,
    };
  }
}
