import { describe, it, expect } from 'vitest';

import {
  availableQuantity,
  canTransitionReservation,
  deriveStockStatus,
  isTerminalReservationStatus,
  satisfiesQuantityInvariants,
} from '../../../src/modules/inventory/domain/entities/Inventory';

describe('Inventory domain rules', () => {
  it('derives available as onHand minus reserved', () => {
    expect(availableQuantity({ onHand: 100, reserved: 30 })).toBe(70);
    expect(availableQuantity({ onHand: 0, reserved: 0 })).toBe(0);
  });

  it('derives stock status from available versus threshold', () => {
    expect(deriveStockStatus({ onHand: 100, reserved: 0, lowStockThreshold: 5 })).toBe('IN_STOCK');
    expect(deriveStockStatus({ onHand: 5, reserved: 0, lowStockThreshold: 5 })).toBe('LOW_STOCK');
    expect(deriveStockStatus({ onHand: 10, reserved: 9, lowStockThreshold: 5 })).toBe('LOW_STOCK');
    expect(deriveStockStatus({ onHand: 10, reserved: 10, lowStockThreshold: 5 })).toBe(
      'OUT_OF_STOCK',
    );
  });

  it('enforces quantity invariants', () => {
    expect(satisfiesQuantityInvariants({ onHand: 10, reserved: 4, sold: 6 })).toBe(true);
    expect(satisfiesQuantityInvariants({ onHand: -1, reserved: 0, sold: 0 })).toBe(false);
    expect(satisfiesQuantityInvariants({ onHand: 5, reserved: 6, sold: 0 })).toBe(false);
    expect(satisfiesQuantityInvariants({ onHand: 5.5, reserved: 0, sold: 0 })).toBe(false);
    expect(satisfiesQuantityInvariants({ onHand: 5, reserved: -1, sold: 0 })).toBe(false);
  });

  it('restricts reservation transitions to active -> terminal', () => {
    expect(canTransitionReservation('active', 'released')).toBe(true);
    expect(canTransitionReservation('active', 'expired')).toBe(true);
    expect(canTransitionReservation('active', 'confirmed')).toBe(true);
    expect(canTransitionReservation('released', 'confirmed')).toBe(false);
    expect(canTransitionReservation('expired', 'released')).toBe(false);
    expect(canTransitionReservation('confirmed', 'released')).toBe(false);
    expect(canTransitionReservation('active', 'active')).toBe(false);
    expect(isTerminalReservationStatus('active')).toBe(false);
    expect(isTerminalReservationStatus('released')).toBe(true);
    expect(isTerminalReservationStatus('expired')).toBe(true);
    expect(isTerminalReservationStatus('confirmed')).toBe(true);
  });
});
