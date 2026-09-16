export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export type ReservationStatus = 'active' | 'released' | 'expired' | 'confirmed';

export type AdjustmentReason =
  | 'RECEIPT'
  | 'DAMAGE'
  | 'LOSS'
  | 'RETURN'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'CYCLE_COUNT'
  | 'MANUAL_CORRECTION';

export type MovementType = 'INIT' | 'ADJUST' | 'RESERVE' | 'RELEASE' | 'EXPIRE' | 'CONFIRM';

export interface Inventory {
  readonly id: string;
  readonly sku: string;
  readonly productId: string;
  readonly variantId: string;
  readonly onHand: number;
  readonly reserved: number;
  readonly sold: number;
  readonly lowStockThreshold: number;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastMovementAt: Date;
}

export interface Reservation {
  readonly id: string;
  readonly inventoryId: string;
  readonly sku: string;
  readonly productId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly status: ReservationStatus;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly idempotencyKey: string | null;
  readonly expiresAt: Date;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface InventoryMovement {
  readonly id: string;
  readonly inventoryId: string;
  readonly sku: string;
  readonly type: MovementType;
  readonly quantityDelta: number;
  readonly previousOnHand: number;
  readonly previousReserved: number;
  readonly newOnHand: number;
  readonly newReserved: number;
  readonly reason: string;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly actorType: string;
  readonly actorId: string;
  readonly idempotencyKey: string | null;
  readonly correlationId: string;
  readonly createdAt: Date;
}

export const RESERVATION_STATUSES: ReservationStatus[] = [
  'active',
  'released',
  'expired',
  'confirmed',
];

export const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  'RECEIPT',
  'DAMAGE',
  'LOSS',
  'RETURN',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'CYCLE_COUNT',
  'MANUAL_CORRECTION',
];

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
export const DEFAULT_RESERVATION_TTL_SECONDS = 900;
export const MAX_RESERVATION_TTL_SECONDS = 3600;
export const MIN_RESERVATION_TTL_SECONDS = 60;
export const MAX_RESERVATION_QUANTITY = 1000;
export const MAX_ADJUSTMENT_DELTA = 1000000;

export function availableQuantity(record: Pick<Inventory, 'onHand' | 'reserved'>): number {
  return record.onHand - record.reserved;
}

export function deriveStockStatus(
  record: Pick<Inventory, 'onHand' | 'reserved' | 'lowStockThreshold'>,
): StockStatus {
  const available = availableQuantity(record);
  if (available <= 0) return 'OUT_OF_STOCK';
  if (available <= record.lowStockThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export function satisfiesQuantityInvariants(
  record: Pick<Inventory, 'onHand' | 'reserved' | 'sold'>,
): boolean {
  return (
    Number.isInteger(record.onHand) &&
    Number.isInteger(record.reserved) &&
    Number.isInteger(record.sold) &&
    record.onHand >= 0 &&
    record.reserved >= 0 &&
    record.sold >= 0 &&
    record.reserved <= record.onHand
  );
}

const TERMINAL_RESERVATION_STATES: ReservationStatus[] = ['released', 'expired', 'confirmed'];

export function isTerminalReservationStatus(status: ReservationStatus): boolean {
  return TERMINAL_RESERVATION_STATES.includes(status);
}

export function canTransitionReservation(from: ReservationStatus, to: ReservationStatus): boolean {
  if (from === 'active' && (to === 'released' || to === 'expired' || to === 'confirmed')) {
    return true;
  }
  return false;
}

export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}
