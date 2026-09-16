import type { ProductRepository } from '@modules/catalog/domain/repositories/ProductRepository';
import type { VariantRepository } from '@modules/catalog/domain/repositories/VariantRepository';

import type { CartCatalogPort, CatalogLineInfo } from '../../domain/repositories/CartRepository';

function variantLabelOf(attrs: Record<string, string>): string | null {
  const parts = Object.entries(attrs).map(([k, v]) => `${k}: ${v}`);
  return parts.length > 0 ? parts.join(', ').slice(0, 200) : null;
}

export class MongoCartCatalogAdapter implements CartCatalogPort {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: VariantRepository,
  ) {}

  async resolveSku(sku: string): Promise<CatalogLineInfo | null> {
    const normalized = sku.trim().toUpperCase();
    if (!normalized) return null;
    const variant = await this.variants.findBySku(normalized);
    if (!variant) return null;
    return this.toLineInfo(variant.productId, {
      id: variant.id,
      sku: variant.sku,
      attrs: variant.attrs,
      status: variant.status,
      priceRef: variant.priceRef,
    });
  }

  async resolveProductVariant(
    productId: string,
    variantId?: string,
  ): Promise<CatalogLineInfo | null> {
    const product = await this.products.findById(productId);
    if (!product) return null;
    if (variantId) {
      const variant = await this.variants.findById(variantId);
      if (!variant || variant.productId !== productId) return null;
      return this.toLineInfo(productId, {
        id: variant.id,
        sku: variant.sku,
        attrs: variant.attrs,
        status: variant.status,
        priceRef: variant.priceRef,
      });
    }
    const active = await this.variants.findActiveByProduct(productId);
    if (active.length !== 1) return null;
    const single = active[0]!;
    return this.toLineInfo(productId, {
      id: single.id,
      sku: single.sku,
      attrs: single.attrs,
      status: single.status,
      priceRef: single.priceRef,
    });
  }

  async refreshLineInfo(
    lines: Array<{ sku: string }>,
  ): Promise<Map<string, CatalogLineInfo | null>> {
    const result = new Map<string, CatalogLineInfo | null>();
    for (const line of lines) {
      result.set(line.sku, await this.resolveSku(line.sku));
    }
    return result;
  }

  private async toLineInfo(
    productId: string,
    variant: {
      id: string;
      sku: string;
      attrs: Record<string, string>;
      status: string;
      priceRef: { amountMinor: number; currency: string };
    },
  ): Promise<CatalogLineInfo | null> {
    const product = await this.products.findById(productId);
    if (!product) return null;
    const purchasable = product.status === 'published' && variant.status === 'active';
    const image = product.media.find((m) => m.sortOrder === 0) ?? product.media[0];
    return {
      productId,
      variantId: variant.id,
      sku: variant.sku,
      title: product.title,
      variantLabel: variantLabelOf(variant.attrs),
      imageUrl: image?.url ?? null,
      unitMinor: variant.priceRef.amountMinor,
      currency: variant.priceRef.currency,
      purchasable,
    };
  }
}
