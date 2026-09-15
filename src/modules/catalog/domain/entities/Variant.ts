import type { PriceRef } from './Product';

export type VariantStatus = 'active' | 'discontinued';

export interface VariantDims {
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
}

export interface Variant {
  readonly id: string;
  readonly productId: string;
  readonly sku: string;
  readonly barcode?: string;
  readonly attrs: Record<string, string>;
  readonly attrSignature: string;
  readonly dims?: VariantDims;
  readonly status: VariantStatus;
  readonly priceRef: PriceRef;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const VARIANT_STATUSES: VariantStatus[] = ['active', 'discontinued'];

export function isVariantSellable(status: VariantStatus): boolean {
  return status === 'active';
}
