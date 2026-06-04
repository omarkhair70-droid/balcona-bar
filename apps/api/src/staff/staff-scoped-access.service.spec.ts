import { NotFoundException } from '@nestjs/common';
import { StaffScopedAccessService } from './staff-scoped-access.service';

describe('StaffScopedAccessService', () => {
  it('resolves order branch scope before asserting permission', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          companyId: 'company-1',
          branchId: 'branch-2',
        }),
      },
    };
    const staffAccessService = {
      assertCan: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const service = new StaffScopedAccessService(
      prisma as never,
      staffAccessService as never,
    );

    await service.assertCanForOrder('staff-1', 'orders.accept', 'order-1');

    expect(staffAccessService.assertCan).toHaveBeenCalledWith(
      'staff-1',
      'orders.accept',
      { companyId: 'company-1', branchId: 'branch-2' },
    );
  });

  it('resolves preparation task branch scope before asserting permission', async () => {
    const prisma = {
      preparationTask: {
        findUnique: jest.fn().mockResolvedValue({
          companyId: 'company-1',
          branchId: 'branch-1',
        }),
      },
    };
    const staffAccessService = {
      assertCan: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const service = new StaffScopedAccessService(
      prisma as never,
      staffAccessService as never,
    );

    await service.assertCanForPreparationTask(
      'staff-1',
      'preparation.ready',
      'task-1',
    );

    expect(staffAccessService.assertCan).toHaveBeenCalledWith(
      'staff-1',
      'preparation.ready',
      { companyId: 'company-1', branchId: 'branch-1' },
    );
  });

  it('resolves kitchen ticket branch scope before asserting permission', async () => {
    const prisma = {
      kitchenTicket: {
        findUnique: jest.fn().mockResolvedValue({
          companyId: 'company-1',
          branchId: 'branch-1',
        }),
      },
    };
    const staffAccessService = {
      assertCan: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const service = new StaffScopedAccessService(
      prisma as never,
      staffAccessService as never,
    );

    await service.assertCanForKitchenTicket(
      'staff-1',
      'preparation.read',
      'ticket-1',
    );

    expect(staffAccessService.assertCan).toHaveBeenCalledWith(
      'staff-1',
      'preparation.read',
      { companyId: 'company-1', branchId: 'branch-1' },
    );
  });

  it('resolves print job branch scope before asserting permission', async () => {
    const prisma = {
      printJob: {
        findUnique: jest.fn().mockResolvedValue({
          companyId: 'company-1',
          branchId: 'branch-2',
        }),
      },
    };
    const staffAccessService = {
      assertCan: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const service = new StaffScopedAccessService(
      prisma as never,
      staffAccessService as never,
    );

    await service.assertCanForPrintJob(
      'staff-1',
      'preparation.ready',
      'print-job-1',
    );

    expect(staffAccessService.assertCan).toHaveBeenCalledWith(
      'staff-1',
      'preparation.ready',
      { companyId: 'company-1', branchId: 'branch-2' },
    );
  });

  it('rejects missing printer stations before permission checks', async () => {
    const prisma = {
      printerStation: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const staffAccessService = {
      assertCan: jest.fn(),
    };
    const service = new StaffScopedAccessService(
      prisma as never,
      staffAccessService as never,
    );

    await expect(
      service.assertCanForPrinterStation(
        'staff-1',
        'settings.manage',
        'printer-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(staffAccessService.assertCan).not.toHaveBeenCalled();
  });

  it('rejects missing waiter call entities before permission checks', async () => {
    const prisma = {
      waiterCall: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const staffAccessService = {
      assertCan: jest.fn(),
    };
    const service = new StaffScopedAccessService(
      prisma as never,
      staffAccessService as never,
    );

    await expect(
      service.assertCanForWaiterCall(
        'staff-1',
        'waiter_calls.resolve',
        'call-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(staffAccessService.assertCan).not.toHaveBeenCalled();
  });
});
