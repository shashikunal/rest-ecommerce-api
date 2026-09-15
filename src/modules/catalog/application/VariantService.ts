import { randomUUID } from 'crypto';

import type { Logger } from '@config/logger';
import { ConcurrentUpdateError } from '@modules/users/domain/errors/UserErrors';

import type { PriceRef } from '../domain/entities/Product';
import type { Variant, VariantDims } from '../domain/entities/Variant';
import {
  InvalidTransitionError,
  ProductNotFoundError,
  SkuExistsError,
  VariantNotFoundError,
} from '../domain/errors/CatalogErrors';
import { buildCatalogEvent, type CatalogEventPublisher } from '../domain/events/CatalogEvents';
import {
  assertValidSku,
  attributeSignature,
  normalizeAttrs,
  normalizeSku,
} from '../domain/policies/catalog-policies';
import type { CatalogCache } from '../domain/ports/CatalogPorts';
import type { ProductRepository } from '../domain/repositories/ProductRepository';
import type { VariantRepository } from '../domain/repositories/VariantRepository';

import type { Actor } from './ProductService';

export interface CreateVariantInput {
  sku: string;
  barcode?: string;
  attrs: Record<string, unknown>;
  dims?: VariantDims;
  priceRef: PriceRef;
}

export interface UpdateVariantInput {
  barcode?: string;
  dims?: VariantDims;
  status?: Variant['status'];
  priceRef?: PriceRef;
  version: number;
}

function audit(
  logger: Logger,
  action: string,
  actor: Actor,
  resourceId: string,
  correlationId?: string,
): void {
  logger.info('Catalog audit', {
    actor: actor.id,
    action,
    resource: 'variant',
    resourceId,
    result: 'success',
    correlationId,
  });
}

export class VariantService {
  constructor(
    private readonly products: ProductRepository,
    private readonly variants: VariantRepository,
    private readonly events: CatalogEventPublisher,
    private readonly cache: CatalogCache,
    private readonly logger: Logger,
    private readonly refreshMinPrice: (productId: string) => Promise<void>,
  ) {}

  async createVariant(
    productId: string,
    input: CreateVariantInput,
    actor: Actor,
    correlationId?: string,
  ): Promise<Variant> {
    const product = await this.products.findById(productId);
    if (!product) throw new ProductNotFoundError('Product not found', correlationId);
    if (product.status === 'archived') {
      throw new InvalidTransitionError('Cannot add variants to an archived product', correlationId);
    }
    let sku: string;
    try {
      sku = assertValidSku(input.sku);
    } catch (error) {
      throw new InvalidTransitionError((error as Error).message, correlationId);
    }
    if (await this.variants.findBySku(sku)) {
      throw new SkuExistsError(sku, correlationId);
    }
    let attrs: Record<string, string>;
    try {
      attrs = normalizeAttrs(input.attrs);
    } catch (error) {
      throw new InvalidTransitionError((error as Error).message, correlationId);
    }
    const signature = attributeSignature(attrs);
    if (await this.variants.existsBySignature(productId, signature)) {
      throw new InvalidTransitionError(
        'Duplicate variant attribute combination for this product',
        correlationId,
      );
    }
    if (input.priceRef.amountMinor < 0 || !/^[A-Z]{3}$/.test(input.priceRef.currency)) {
      throw new InvalidTransitionError('Invalid price reference', correlationId);
    }

    const now = new Date();
    const variant: Variant = {
      id: randomUUID(),
      productId,
      sku,
      barcode: input.barcode?.trim(),
      attrs,
      attrSignature: signature,
      dims: input.dims,
      status: 'active',
      priceRef: { ...input.priceRef },
      version: 0,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.variants.create(variant);
    } catch (error) {
      if (/duplicate|E11000/i.test((error as Error).message)) {
        throw new SkuExistsError(sku, correlationId);
      }
      throw error;
    }
    await this.refreshMinPrice(productId);
    await this.cache.invalidate(`product:*`);
    audit(this.logger, 'VARIANT_CREATED', actor, variant.id, correlationId);
    await this.emit(
      'catalog.variantCreated',
      'product',
      productId,
      { productId, variantId: variant.id, sku },
      correlationId,
    );
    await this.emit(
      'search.indexUpdated',
      'product',
      productId,
      { productId, variantId: variant.id },
      correlationId,
    );
    return variant;
  }

  async updateVariant(
    id: string,
    input: UpdateVariantInput,
    actor: Actor,
    correlationId?: string,
  ): Promise<Variant> {
    const variant = await this.variants.findById(id);
    if (!variant) throw new VariantNotFoundError('Variant not found', correlationId);
    if (variant.version !== input.version) {
      throw new ConcurrentUpdateError('Variant was modified by another request', correlationId);
    }
    type MutableVariant = { -readonly [K in keyof Variant]?: Variant[K] };
    const updates: MutableVariant = {};
    if (input.barcode !== undefined) updates.barcode = input.barcode;
    if (input.dims !== undefined) updates.dims = input.dims;
    if (input.status !== undefined) {
      if (input.status !== 'active' && input.status !== 'discontinued') {
        throw new InvalidTransitionError(`Invalid variant status: ${input.status}`, correlationId);
      }
      updates.status = input.status;
    }
    if (input.priceRef !== undefined) {
      if (input.priceRef.amountMinor < 0 || !/^[A-Z]{3}$/.test(input.priceRef.currency)) {
        throw new InvalidTransitionError('Invalid price reference', correlationId);
      }
      updates.priceRef = { ...input.priceRef };
    }
    updates.version = variant.version + 1;

    await this.variants.update(id, updates);
    await this.refreshMinPrice(variant.productId);
    await this.cache.invalidate(`product:*`);
    audit(this.logger, 'VARIANT_UPDATED', actor, id, correlationId);
    await this.emit(
      'catalog.variantUpdated',
      'product',
      variant.productId,
      { productId: variant.productId, variantId: id },
      correlationId,
    );
    await this.emit(
      'search.indexUpdated',
      'product',
      variant.productId,
      { productId: variant.productId },
      correlationId,
    );
    const updated = await this.variants.findById(id);
    if (!updated) throw new VariantNotFoundError('Variant not found', correlationId);
    return updated;
  }

  async removeVariant(id: string, actor: Actor, correlationId?: string): Promise<void> {
    const variant = await this.variants.findById(id);
    if (!variant) throw new VariantNotFoundError('Variant not found', correlationId);
    const product = await this.products.findById(variant.productId);
    if (!product) throw new ProductNotFoundError('Product not found', correlationId);
    if (product.status === 'published') {
      throw new InvalidTransitionError(
        'Cannot delete a variant of a published product. Unpublish first.',
        correlationId,
      );
    }
    await this.variants.remove(id);
    await this.refreshMinPrice(variant.productId);
    await this.cache.invalidate(`product:*`);
    audit(this.logger, 'VARIANT_DELETED', actor, id, correlationId);
    await this.emit(
      'catalog.variantUpdated',
      'product',
      variant.productId,
      { productId: variant.productId, variantId: id, deleted: true },
      correlationId,
    );
  }

  async findBySku(sku: string, correlationId?: string): Promise<Variant> {
    const variant = await this.variants.findBySku(normalizeSku(sku));
    if (!variant) throw new VariantNotFoundError('Variant not found', correlationId);
    return variant;
  }

  private async emit(
    eventType: Parameters<typeof buildCatalogEvent>[0],
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<void> {
    try {
      await this.events.publish(
        buildCatalogEvent(eventType, aggregateType, aggregateId, payload, { correlationId }),
      );
    } catch (error) {
      this.logger.warn('Catalog event publish failed (non-blocking)', {
        error: (error as Error).message,
      });
    }
  }
}
