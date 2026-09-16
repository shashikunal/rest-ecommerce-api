import type { CartService } from '@modules/cart/application/CartService';

import type { CheckoutCartPort, CheckoutCartSnapshot } from '../../domain/ports/CheckoutPorts';

export class CartServiceCheckoutCartAdapter implements CheckoutCartPort {
  constructor(private readonly carts: CartService) {}

  async getCart(userId: string, correlationId?: string): Promise<CheckoutCartSnapshot | null> {
    const view = await this.carts.getCart(userId, correlationId);
    return {
      cartId: view.id,
      version: view.version,
      status: view.status,
      currency: view.currency,
      items: view.items.map((item) => ({
        sku: item.sku,
        productId: item.productId,
        variantId: item.variantId,
        title: item.title,
        quantity: item.quantity,
        unitMinor: item.unitMinor,
        currency: item.currency,
      })),
    };
  }
}
