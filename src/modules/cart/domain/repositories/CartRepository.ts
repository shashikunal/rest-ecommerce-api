import type { Cart, CartItem } from '../entities/Cart';

export interface AddItemResult {
  cart: Cart;
  created: boolean;
}

export interface CartRepository {
  getByUserId(userId: string): Promise<Cart | null>;
  getOrCreate(userId: string): Promise<Cart>;
  addOrMergeItem(
    userId: string,
    expectedVersion: number | null,
    item: Omit<CartItem, 'priceStale' | 'unavailable'>,
  ): Promise<AddItemResult>;
  updateQuantity(
    userId: string,
    itemId: string,
    quantity: number,
    expectedVersion: number,
  ): Promise<Cart>;
  removeItem(userId: string, itemId: string, expectedVersion: number | null): Promise<Cart>;
  clear(userId: string, expectedVersion: number | null): Promise<Cart>;
  markConverted(userId: string): Promise<void>;
}

export interface CatalogLineInfo {
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  variantLabel: string | null;
  imageUrl: string | null;
  unitMinor: number;
  currency: string;
  purchasable: boolean;
}

export interface CartCatalogPort {
  resolveSku(sku: string): Promise<CatalogLineInfo | null>;
  resolveProductVariant(productId: string, variantId?: string): Promise<CatalogLineInfo | null>;
  refreshLineInfo(lines: Array<{ sku: string }>): Promise<Map<string, CatalogLineInfo | null>>;
}
