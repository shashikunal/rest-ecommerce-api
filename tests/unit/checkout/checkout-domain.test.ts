import { describe, it, expect } from 'vitest';

import {
  canTransitionCheckoutStatus,
  isTerminalCheckoutStatus,
  priceLineTotal,
  sumLineTotals,
} from '../../../src/modules/checkout/domain/entities/Checkout';

describe('Checkout state machine', () => {
  it('allows only the documented forward transitions', () => {
    expect(canTransitionCheckoutStatus('priced', 'reserved')).toBe(true);
    expect(canTransitionCheckoutStatus('reserved', 'ready')).toBe(true);
    expect(canTransitionCheckoutStatus('ready', 'completed')).toBe(true);
    expect(canTransitionCheckoutStatus('priced', 'cancelled')).toBe(true);
    expect(canTransitionCheckoutStatus('reserved', 'expired')).toBe(true);
    expect(canTransitionCheckoutStatus('ready', 'failed')).toBe(true);
    expect(canTransitionCheckoutStatus('priced', 'ready')).toBe(false);
    expect(canTransitionCheckoutStatus('reserved', 'completed')).toBe(false);
    expect(canTransitionCheckoutStatus('cancelled', 'priced')).toBe(false);
    expect(canTransitionCheckoutStatus('completed', 'cancelled')).toBe(false);
    expect(canTransitionCheckoutStatus('failed', 'ready')).toBe(false);
    expect(canTransitionCheckoutStatus('expired', 'cancelled')).toBe(false);
  });

  it('marks terminal states', () => {
    expect(isTerminalCheckoutStatus('completed')).toBe(true);
    expect(isTerminalCheckoutStatus('failed')).toBe(true);
    expect(isTerminalCheckoutStatus('expired')).toBe(true);
    expect(isTerminalCheckoutStatus('cancelled')).toBe(true);
    expect(isTerminalCheckoutStatus('priced')).toBe(false);
    expect(isTerminalCheckoutStatus('reserved')).toBe(false);
    expect(isTerminalCheckoutStatus('ready')).toBe(false);
  });

  it('computes money in integer minor units', () => {
    expect(priceLineTotal(2, 1999)).toBe(3998);
    expect(
      sumLineTotals([
        { quantity: 2, unitMinor: 1999 },
        { quantity: 1, unitMinor: 500 },
      ]),
    ).toBe(4498);
    expect(sumLineTotals([])).toBe(0);
  });
});
