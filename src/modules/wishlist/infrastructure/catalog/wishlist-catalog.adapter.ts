import type { ProductRepository } from '@modules/catalog/domain/repositories/ProductRepository';
import type { VariantRepository } from '@modules/catalog/domain/repositories/VariantRepository';

import type {
  WishlistCatalogInfo,
  WishlistCatalogPort,
} from '../../domain/repositories/WishlistRepository';

export class MongoWishlistCatalogAdapter implements WishlistCatalogPort {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: VariantRepository,
  ) {}

  async lookup(
    sku?: string,
    productId?: string,
    variantId?: string | null,
  ): Promise<WishlistCatalogInfo | null> {
    if (sku) {
      const variant = await this.variants.findBySku(sku.trim().toUpperCase());
      if (!variant) return null;
      return this.describe(variant.productId, variant.id);
    }
    if (productId) {
      if (variantId) {
        const variant = await this.variants.findById(variantId);
        if (!variant || variant.productId !== productId) return null;
        return this.describe(productId, variant.id);
      }
      const product = await this.products.findById(productId);
      if (!product) return null;
      const active = await this.variants.findActiveByProduct(productId);
      const first = active[0];
      return {
        productId,
        variantId: first?.id ?? null,
        sku: first?.sku ?? '',
        title: product.title,
        imageUrl: product.media[0]?.url ?? null,
        unitMinor: first?.priceRef.amountMinor ?? product.minPrice?.amountMinor ?? null,
        currency: first?.priceRef.currency ?? product.minPrice?.currency ?? null,
        available: product.status === 'published',
        exists: true,
      };
    }
    return null;
  }

  async refresh(
    items: Array<{ sku: string; productId: string }>,
  ): Promise<Map<string, WishlistCatalogInfo | null>> {
    const result = new Map<string, WishlistCatalogInfo | null>();
    for (const item of items) {
      const variant = await this.variants.findBySku(item.sku).catch(() => null);
      if (variant) {
        result.set(item.sku, await this.describe(variant.productId, variant.id));
        continue;
      }
      const product = await this.products.findById(item.productId).catch(() => null);
      if (!product) {
        result.set(item.sku, null);
        continue;
      }
      result.set(item.sku, {
        productId: item.productId,
        variantId: null,
        sku: item.sku,
        title: product.title,
        imageUrl: product.media[0]?.url ?? null,
        unitMinor: product.minPrice?.amountMinor ?? null,
        currency: product.minPrice?.currency ?? null,
        available: product.status === 'published',
        exists: true,
      });
    }
    return result;
  }

  private async describe(
    productId: string,
    variantId: string,
  ): Promise<WishlistCatalogInfo | null> {
    const [product, variant] = await Promise.all([
      this.products.findById(productId),
      this.variants.findById(variantId),
    ]);
    if (!product || !variant) return null;
    return {
      productId,
      variantId: variant.id,
      sku: variant.sku,
      title: product.title,
      imageUrl: product.media[0]?.url ?? null,
      unitMinor: variant.priceRef.amountMinor,
      currency: variant.priceRef.currency,
      available: product.status === 'published' && variant.status === 'active',
      exists: true,
    };
  }
}
