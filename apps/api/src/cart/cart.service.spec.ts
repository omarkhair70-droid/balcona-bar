import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CartService } from './cart.service';

const session = {
  id: 'session-1',
  companyId: 'company-1',
  branchId: 'branch-1',
  status: 'active',
  expiresAt: null,
};

const cart = {
  id: 'cart-1',
  currency: 'EGP',
};

const payload = {
  menuItemId: 'menu-item-1',
  quantity: 1,
  selectedModifiers: [],
};

function createService(prisma: Record<string, unknown> = {}) {
  const service = new CartService(prisma as never, {} as never) as any;

  service.resolveActiveTableSession = jest.fn().mockResolvedValue(session);
  service.prepareCartItem = jest.fn().mockResolvedValue({
    menuItem: {
      id: 'menu-item-1',
      name: 'Spanish Latte',
      slug: 'spanish-latte',
      basePriceMinor: 12000,
    },
    notes: null,
    currency: 'EGP',
    effectiveBasePriceMinor: 12000,
    modifiersTotalMinor: 0,
    unitPriceMinor: 12000,
    modifierOptions: [],
  });
  service.findOrCreateDraftCart = jest.fn().mockResolvedValue(cart);
  service.getCartById = jest.fn().mockResolvedValue({ id: cart.id, items: [] });
  service.toCartResponse = jest.fn().mockReturnValue({
    cart: { id: cart.id },
    items: [],
    totals: { itemCount: 0, totalQuantity: 0, subtotalMinor: 0, currency: 'EGP' },
  });

  return service as CartService & Record<string, jest.Mock>;
}

describe('CartService add item idempotency', () => {
  it('stores a normalized idempotency key on new cart items', async () => {
    const service = createService();
    const tx = {
      cartItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'cart-item-1' }),
      },
    };

    await service.addItemWithTransaction(
      session.id,
      payload,
      tx as never,
      ' add-key-1 ',
    );

    expect(tx.cartItem.findFirst).toHaveBeenCalledWith({
      where: { cartId: cart.id, idempotencyKey: 'add-key-1' },
      select: { id: true },
    });
    expect(tx.cartItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cartId: cart.id,
        menuItemId: payload.menuItemId,
        idempotencyKey: 'add-key-1',
      }),
      select: { id: true },
    });
  });

  it('replays an existing cart response without creating a duplicate item', async () => {
    const service = createService();
    const tx = {
      cartItem: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cart-item-existing' }),
        create: jest.fn(),
      },
    };

    await service.addItemWithTransaction(
      session.id,
      payload,
      tx as never,
      'add-key-1',
    );

    expect(tx.cartItem.create).not.toHaveBeenCalled();
    expect((service as any).getCartById).toHaveBeenCalledWith(cart.id, tx);
  });

  it('replays safely when a duplicate idempotency key races the create', async () => {
    const service = createService();
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on idempotency key',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['cartId', 'idempotencyKey'] },
      },
    );
    const tx = {
      cartItem: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'cart-item-existing' }),
        create: jest.fn().mockRejectedValue(uniqueError),
      },
    };

    await service.addItemWithTransaction(
      session.id,
      payload,
      tx as never,
      'add-key-1',
    );

    expect((service as any).getCartById).toHaveBeenCalledWith(cart.id, tx);
  });

  it('accepts a smoke-style item with required size and temperature modifiers', () => {
    const service = createService();
    const menuItem = {
      modifierGroups: [
        {
          modifierGroup: {
            id: 'size-group',
            name: 'Size',
            status: 'active',
            isRequired: true,
            minSelections: 1,
            maxSelections: 1,
            selectionType: 'single',
            options: [
              {
                id: 'small-option',
                name: 'Small',
                status: 'active',
                priceDeltaMinor: 0,
              },
            ],
          },
        },
        {
          modifierGroup: {
            id: 'temperature-group',
            name: 'Temperature',
            status: 'active',
            isRequired: true,
            minSelections: 1,
            maxSelections: 1,
            selectionType: 'single',
            options: [
              {
                id: 'iced-option',
                name: 'Iced',
                status: 'active',
                priceDeltaMinor: 0,
              },
            ],
          },
        },
      ],
    };

    expect(
      (service as any).validateSelectedModifiers(menuItem, [
        { modifierGroupId: 'size-group', optionIds: ['small-option'] },
        { modifierGroupId: 'temperature-group', optionIds: ['iced-option'] },
      ]),
    ).toEqual([
      {
        group: menuItem.modifierGroups[0].modifierGroup,
        option: menuItem.modifierGroups[0].modifierGroup.options[0],
      },
      {
        group: menuItem.modifierGroups[1].modifierGroup,
        option: menuItem.modifierGroups[1].modifierGroup.options[0],
      },
    ]);
  });

  it('hydrates the add item response after the critical transaction commits', async () => {
    let insideTransaction = false;
    const tx = {
      cartItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'cart-item-1' }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (txClient: typeof tx) => Promise<unknown>) => {
        insideTransaction = true;
        try {
          return await callback(tx);
        } finally {
          insideTransaction = false;
        }
      }),
    };
    const service = createService(prisma);

    (service as any).getCartById.mockImplementation(async (
      cartId: string,
      executor: unknown,
    ) => {
      expect(insideTransaction).toBe(false);
      expect(executor).toBe(prisma);

      return { id: cartId, items: [] };
    });

    await service.addItem(session.id, payload, 'add-key-1');

    expect(tx.cartItem.create).toHaveBeenCalledTimes(1);
    expect((service as any).getCartById).toHaveBeenCalledWith(cart.id, prisma);
  });

  it('rejects idempotency keys that exceed the bounded header length', async () => {
    const service = createService();

    await expect(
      service.addItemWithTransaction(
        session.id,
        payload,
        { cartItem: {} } as never,
        'x'.repeat(129),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
