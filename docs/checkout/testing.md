# Checkout — Testing

- Unit (`tests/unit/checkout/checkout-domain.test.ts`): transition matrix,
  terminal states, integer money math.
- Service (`tests/unit/checkout/checkout-service.test.ts`): authoritative
  snapshot pricing, empty/unavailable rejection, idempotent replay vs
  `IDEMPOTENCY_CONFLICT`, cart-drift and price-drift detection with
  failed-marking, full reserve saga → ready (+ replay), partial-failure
  compensation (one release, failed status + reason), cancel idempotency
  (single release), lazy + sweep expiry, version-guarded address updates,
  order-handoff `complete`/`getForOrder` guards.
- API (`tests/integration/checkout.test.ts`): end-to-end lifecycle over HTTP,
  required-key + tamper rejection, duplicate-create replay, 422 validate on
  price change (+ reserve blocked after), partial compensation over HTTP,
  BOLA isolation + 401s, sweep RBAC (customer 403) + expiry + stock return,
  stale-version 409.
- Load (`tests/integration/checkout-load.test.ts`): 200 concurrent
  create(+replay probe)+reserve flows against real `InventoryService` with
  stock 50 (qty 2/line) → exactly 25 `ready`, 150 `failed` (stockout), 0
  unexpected errors, `reserved = 50`, 25 reservations, 25 distinct ready
  checkouts. See `performance.md`.
- Regression: full suite green (238 tests); `tsc` clean for new code;
  eslint clean for new files; `npm run build` passes. Pre-existing issues in
  untouched files unchanged.
