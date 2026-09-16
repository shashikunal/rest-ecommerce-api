import type {
  Inventory,
  InventoryMovement,
  Reservation,
  ReservationStatus,
} from '../entities/Inventory';

export interface InventoryListOptions {
  sku?: string;
  status?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  limit: number;
  cursor?: string;
}

export interface InventoryListResult {
  records: Inventory[];
  nextCursor: string | null;
}

export interface AdjustmentOutcome {
  record: Inventory;
  previousOnHand: number;
  previousReserved: number;
}

export interface InventoryRepository {
  findById(id: string): Promise<Inventory | null>;
  findBySku(sku: string): Promise<Inventory | null>;
  create(record: Inventory): Promise<void>;
  list(options: InventoryListOptions): Promise<InventoryListResult>;
  applyAdjustment(skuOrId: string, delta: number): Promise<AdjustmentOutcome | null>;
  reserveStock(sku: string, quantity: number): Promise<Inventory | null>;
  releaseStock(sku: string, quantity: number): Promise<Inventory | null>;
  commitStock(sku: string, quantity: number): Promise<Inventory | null>;
}

export interface ReservationRepository {
  findById(id: string): Promise<Reservation | null>;
  findByIdempotencyKey(key: string): Promise<Reservation | null>;
  create(reservation: Reservation): Promise<void>;
  transition(
    id: string,
    from: ReservationStatus[],
    to: ReservationStatus,
  ): Promise<Reservation | null>;
  findActiveExpired(now: Date, limit: number): Promise<Reservation[]>;
}

export interface MovementRepository {
  append(movement: InventoryMovement): Promise<void>;
  findByIdempotencyKey(key: string): Promise<InventoryMovement | null>;
  findByInventoryId(
    inventoryId: string,
    limit: number,
    cursor?: string,
  ): Promise<{
    movements: InventoryMovement[];
    nextCursor: string | null;
  }>;
}

export interface CatalogVariantRef {
  productId: string;
  variantId: string;
  sku: string;
  active: boolean;
}

export interface InventoryCatalogPort {
  resolveSku(sku: string): Promise<CatalogVariantRef | null>;
  resolveVariant(productId: string, variantId: string): Promise<CatalogVariantRef | null>;
}
