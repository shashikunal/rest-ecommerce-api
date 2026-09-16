import type { ProductRepository } from '@modules/catalog/domain/repositories/ProductRepository';
import type { VariantRepository } from '@modules/catalog/domain/repositories/VariantRepository';

import type { CatalogPriceLine, CheckoutCatalogPort } from '../../domain/ports/CheckoutPorts';

function variantLabelOf(attrs: Record<string, string>): string | null {
  const parts = Object.entries(attrs).map(([key, value]) => `${key}: ${value}`);
  return parts.length > 0 ? parts.join(', ').slice(0, 200) : null;
}

export class MongoCheckoutCatalogAdapter implements CheckoutCatalogPort {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: VariantRepository,
  ) {}

  async getLine(sku: string): Promise<CatalogPriceLine | null> {
    const normalized = sku.trim().toUpperCase();
    if (!normalized) return null;
    const variant = await this.variants.findBySku(normalized);
    if (!variant) return null;
    const product = await this.products.findById(variant.productId);
    if (!product) return null;
    const image = product.media.find((m) => m.sortOrder === 0) ?? product.media[0];
    void image;
    return {
      productId: variant.productId,
      variantId: variant.id,
      sku: variant.sku,
      title: product.title,
      variantLabel: variantLabelOf(variant.attrs),
      unitMinor: variant.priceRef.amountMinor,
      currency: variant.priceRef.currency,
      purchasable: product.status === 'published' && variant.status === 'active',
    };
  }
}
