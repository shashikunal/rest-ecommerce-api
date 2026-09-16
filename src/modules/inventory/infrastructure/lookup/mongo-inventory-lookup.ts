import type { InventoryLookup } from '@modules/catalog/domain/ports/CatalogPorts';

import { deriveStockStatus } from '../../domain/entities/Inventory';
import type { InventoryRepository } from '../../domain/repositories/InventoryRepository';

export class MongoInventoryLookup implements InventoryLookup {
  constructor(private readonly inventories: InventoryRepository) {}

  async availabilityFor(
    skus: string[],
  ): Promise<Record<string, 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN'>> {
    const result: Record<string, 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN'> = {};
    for (const sku of skus) {
      const record = await this.inventories.findBySku(sku);
      if (!record) {
        result[sku] = 'UNKNOWN';
        continue;
      }
      result[sku] = deriveStockStatus(record) === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'IN_STOCK';
    }
    return result;
  }
}
