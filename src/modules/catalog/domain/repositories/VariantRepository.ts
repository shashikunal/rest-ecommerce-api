import type { Variant } from '../entities/Variant';

export interface VariantRepository {
  create(variant: Variant): Promise<void>;
  findById(id: string): Promise<Variant | null>;
  findBySku(sku: string): Promise<Variant | null>;
  findActiveByProduct(productId: string): Promise<Variant[]>;
  findAllByProduct(productId: string): Promise<Variant[]>;
  update(id: string, updates: Partial<Variant>): Promise<void>;
  remove(id: string): Promise<void>;
  existsBySignature(productId: string, attrSignature: string, exceptId?: string): Promise<boolean>;
  countActiveByProduct(productId: string): Promise<number>;
}
