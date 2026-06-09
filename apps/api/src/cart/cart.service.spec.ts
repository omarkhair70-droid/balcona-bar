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

function createService() {
  const service = new CartService({} as never, {} as never) as any;

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
        findFirst: jest.fn().mockResolvedValue(null),
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
