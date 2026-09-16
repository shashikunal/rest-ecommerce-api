import type { Wishlist } from '../entities/Wishlist';

export interface WishlistAddResult {
  wishlist: Wishlist;
  created: boolean;
}

export interface WishlistRepository {
  getByUserId(userId: string): Promise<Wishlist | null>;
  getOrCreate(userId: string): Promise<Wishlist>;
  addItem(
    userId: string,
    item: {
      itemId: string;
      productId: string;
      variantId: string | null;
      sku: string;
      addedAt: Date;
    },
  ): Promise<WishlistAddResult>;
  removeItem(userId: string, itemId: string): Promise<Wishlist>;
  list(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ wishlist: Wishlist; nextCursor: string | null; hasMore: boolean }>;
}

export interface WishlistCatalogInfo {
  productId: string;
  variantId: string | null;
  sku: string;
  title: string;
  imageUrl: string | null;
  unitMinor: number | null;
  currency: string | null;
  available: boolean;
  exists: boolean;
}

export interface WishlistCatalogPort {
  lookup(
    sku?: string,
    productId?: string,
    variantId?: string | null,
  ): Promise<WishlistCatalogInfo | null>;
  refresh(
    items: Array<{ sku: string; productId: string }>,
  ): Promise<Map<string, WishlistCatalogInfo | null>>;
}
