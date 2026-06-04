import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffAccessService, StaffPermissionScope } from './staff-access.service';
import { StaffPermission } from './permissions';

type ScopedRecord = {
  companyId: string;
  branchId?: string | null;
};

@Injectable()
export class StaffScopedAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffAccessService: StaffAccessService,
  ) {}

  assertCanForBranch(
    staffUserId: string,
    permission: StaffPermission,
    branchId: string,
  ) {
    return this.staffAccessService.assertCan(staffUserId, permission, {
      branchId,
    });
  }

  assertCanForCompany(
    staffUserId: string,
    permission: StaffPermission,
    companyId: string,
  ) {
    return this.staffAccessService.assertCan(staffUserId, permission, {
      companyId,
    });
  }

  async assertCanForOrder(
    staffUserId: string,
    permission: StaffPermission,
    orderId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(staffUserId, permission, order, 'Order');
  }

  async assertCanForPreparationTask(
    staffUserId: string,
    permission: StaffPermission,
    taskId: string,
  ) {
    const task = await this.prisma.preparationTask.findUnique({
      where: { id: taskId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      task,
      'Preparation task',
    );
  }

  async assertCanForKitchenTicket(
    staffUserId: string,
    permission: StaffPermission,
    ticketId: string,
  ) {
    const ticket = await this.prisma.kitchenTicket.findUnique({
      where: { id: ticketId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      ticket,
      'Kitchen ticket',
    );
  }

  async assertCanForPrintJob(
    staffUserId: string,
    permission: StaffPermission,
    printJobId: string,
  ) {
    const printJob = await this.prisma.printJob.findUnique({
      where: { id: printJobId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      printJob,
      'Print job',
    );
  }

  async assertCanForPrinterStation(
    staffUserId: string,
    permission: StaffPermission,
    printerStationId: string,
  ) {
    const printerStation = await this.prisma.printerStation.findUnique({
      where: { id: printerStationId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      printerStation,
      'Printer station',
    );
  }

  async assertCanForWaiterCall(
    staffUserId: string,
    permission: StaffPermission,
    waiterCallId: string,
  ) {
    const waiterCall = await this.prisma.waiterCall.findUnique({
      where: { id: waiterCallId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      waiterCall,
      'Waiter call',
    );
  }

  async assertCanForBillRequest(
    staffUserId: string,
    permission: StaffPermission,
    billRequestId: string,
  ) {
    const billRequest = await this.prisma.billRequest.findUnique({
      where: { id: billRequestId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      billRequest,
      'Bill request',
    );
  }

  async assertCanForTableSession(
    staffUserId: string,
    permission: StaffPermission,
    sessionId: string,
  ) {
    const tableSession = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      tableSession,
      'Table session',
    );
  }

  async assertCanForAiWaiterSession(
    staffUserId: string,
    permission: StaffPermission,
    aiWaiterSessionId: string,
  ) {
    const aiWaiterSession = await this.prisma.aiWaiterSession.findUnique({
      where: { id: aiWaiterSessionId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      aiWaiterSession,
      'AI waiter session',
    );
  }

  async assertCanForMenuCategory(
    staffUserId: string,
    permission: StaffPermission,
    categoryId: string,
  ) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { companyId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      category,
      'Menu category',
    );
  }

  async assertCanForMenuItem(
    staffUserId: string,
    permission: StaffPermission,
    itemId: string,
  ) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      select: { companyId: true },
    });

    return this.assertCanForRecord(staffUserId, permission, item, 'Menu item');
  }

  async assertCanForModifierGroup(
    staffUserId: string,
    permission: StaffPermission,
    groupId: string,
  ) {
    const modifierGroup = await this.prisma.modifierGroup.findUnique({
      where: { id: groupId },
      select: { companyId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      modifierGroup,
      'Modifier group',
    );
  }

  async assertCanForModifierOption(
    staffUserId: string,
    permission: StaffPermission,
    optionId: string,
  ) {
    const modifierOption = await this.prisma.modifierOption.findUnique({
      where: { id: optionId },
      select: {
        group: {
          select: { companyId: true },
        },
      },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      modifierOption?.group,
      'Modifier option',
    );
  }

  async assertCanForMenuItemModifierGroup(
    staffUserId: string,
    permission: StaffPermission,
    itemId: string,
    linkId: string,
  ) {
    const link = await this.prisma.menuItemModifierGroup.findUnique({
      where: { id: linkId },
      select: {
        menuItemId: true,
        menuItem: {
          select: { companyId: true },
        },
      },
    });

    if (!link || link.menuItemId !== itemId) {
      throw new NotFoundException('Menu item modifier group not found');
    }

    return this.assertCanForRecord(
      staffUserId,
      permission,
      link.menuItem,
      'Menu item modifier group',
    );
  }

  async assertCanForSmartCashierRule(
    staffUserId: string,
    permission: StaffPermission,
    ruleId: string,
  ) {
    const rule = await this.prisma.smartCashierReviewRule.findUnique({
      where: { id: ruleId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      rule,
      'Smart cashier rule',
    );
  }

  async assertCanForVenueZone(
    staffUserId: string,
    permission: StaffPermission,
    venueZoneId: string,
  ) {
    const venueZone = await this.prisma.venueZone.findUnique({
      where: { id: venueZoneId },
      select: { companyId: true, branchId: true },
    });

    return this.assertCanForRecord(
      staffUserId,
      permission,
      venueZone,
      'Venue zone',
    );
  }

  private assertCanForRecord(
    staffUserId: string,
    permission: StaffPermission,
    record: ScopedRecord | null | undefined,
    label: string,
  ) {
    if (!record) {
      throw new NotFoundException(`${label} not found`);
    }

    return this.staffAccessService.assertCan(
      staffUserId,
      permission,
      this.scopeFromRecord(record),
    );
  }

  private scopeFromRecord(record: ScopedRecord): StaffPermissionScope {
    return record.branchId
      ? { companyId: record.companyId, branchId: record.branchId }
      : { companyId: record.companyId };
  }
}
