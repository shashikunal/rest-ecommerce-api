import type { ProductRepository } from '@modules/catalog/domain/repositories/ProductRepository';
import type { VariantRepository } from '@modules/catalog/domain/repositories/VariantRepository';

import type {
  CatalogVariantRef,
  InventoryCatalogPort,
} from '../../domain/repositories/InventoryRepository';

export class MongoInventoryCatalogAdapter implements InventoryCatalogPort {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: VariantRepository,
  ) {}

  async resolveSku(sku: string): Promise<CatalogVariantRef | null> {
    const normalized = sku.trim().toUpperCase();
    if (!normalized) return null;
    const variant = await this.variants.findBySku(normalized);
    if (!variant) return null;
    return this.toRef(variant.productId, {
      id: variant.id,
      sku: variant.sku,
      status: variant.status,
    });
  }

  async resolveVariant(productId: string, variantId: string): Promise<CatalogVariantRef | null> {
    const variant = await this.variants.findById(variantId);
    if (!variant || variant.productId !== productId) return null;
    return this.toRef(productId, { id: variant.id, sku: variant.sku, status: variant.status });
  }

  private async toRef(
    productId: string,
    variant: { id: string; sku: string; status: string },
  ): Promise<CatalogVariantRef | null> {
    const product = await this.products.findById(productId);
    if (!product) return null;
    return {
      productId,
      variantId: variant.id,
      sku: variant.sku,
      active: product.status === 'published' && variant.status === 'active',
    };
  }
}
