import type { InventoryService } from '@modules/inventory/application/InventoryService';

import type { CheckoutInventoryPort } from '../../domain/ports/CheckoutPorts';

const SYSTEM_ACTOR = { type: 'system' as const, id: 'checkout-orchestrator' };

export class InventoryServiceCheckoutInventoryAdapter implements CheckoutInventoryPort {
  constructor(private readonly inventory: InventoryService) {}

  async reserve(
    input: {
      sku: string;
      quantity: number;
      referenceId: string;
      idempotencyKey: string;
      ttlSeconds: number;
    },
    correlationId?: string,
  ): Promise<{ reservationId: string; sku: string; quantity: number }> {
    const { reservation } = await this.inventory.reserve(
      {
        sku: input.sku,
        quantity: input.quantity,
        referenceType: 'checkout',
        referenceId: input.referenceId,
        idempotencyKey: input.idempotencyKey,
        ttlSeconds: input.ttlSeconds,
      },
      { ...SYSTEM_ACTOR, id: `checkout:${input.referenceId}` },
      correlationId,
    );
    return { reservationId: reservation.id, sku: reservation.sku, quantity: reservation.quantity };
  }

  async release(reservationId: string, correlationId?: string): Promise<void> {
    await this.inventory.release(
      reservationId,
      { ...SYSTEM_ACTOR, id: `checkout:${reservationId}` },
      {},
      correlationId,
    );
  }
}
