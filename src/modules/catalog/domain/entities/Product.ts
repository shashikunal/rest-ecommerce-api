export type ProductStatus = 'draft' | 'published' | 'archived';

export interface PriceRef {
  amountMinor: number;
  currency: string;
}

export interface MediaRef {
  mediaId: string;
  key: string;
  url: string;
  type: string;
  altText?: string;
  sortOrder: number;
  width?: number;
  height?: number;
  bytes?: number;
}

export interface SeoMeta {
  title?: string;
  description?: string;
}

export interface Product {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly shortDescription?: string;
  readonly categoryId: string;
  readonly brandId?: string;
  readonly attrs: Record<string, string>;
  readonly media: MediaRef[];
  readonly status: ProductStatus;
  readonly seo?: SeoMeta;
  readonly minPrice?: PriceRef;
  readonly version: number;
  readonly deletedAt?: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const ALLOWED_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  draft: ['published', 'archived'],
  published: ['draft', 'archived'],
  archived: [],
};

export function canTransitionProductStatus(from: ProductStatus, to: ProductStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function isPubliclyVisible(status: ProductStatus): boolean {
  return status === 'published';
}

export const PRODUCT_STATUSES: ProductStatus[] = ['draft', 'published', 'archived'];
