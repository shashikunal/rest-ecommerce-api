export type WishlistItemState = 'AVAILABLE' | 'UNAVAILABLE' | 'REMOVED';

export interface WishlistItem {
  readonly itemId: string;
  readonly productId: string;
  readonly variantId: string | null;
  readonly sku: string;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly unitMinor: number | null;
  readonly currency: string | null;
  readonly state: WishlistItemState;
  readonly addedAt: Date;
}

export interface Wishlist {
  readonly id: string;
  readonly userId: string;
  readonly items: WishlistItem[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const WISHLIST_MAX_ITEMS = 200;

export function wishlistItemKey(productId: string, variantId: string | null, sku: string): string {
  return `${productId}::${variantId ?? sku.toUpperCase()}`;
}
