# Inventory — Testing

- Unit (`tests/unit/inventory/inventory-domain.test.ts`): available math,
  status derivation incl. boundary (`available == threshold` → LOW),
  invariant predicate (negatives, over-reserved, non-integers), transition
  legality matrix.
- Service (`tests/unit/inventory/inventory-service.test.ts`): adjust/DMG/LOSS
  bounds, reserved-breach rejection, adjust idempotent replay, single
  lowStock emission on threshold crossing, full reserve→release→reserve→
  confirm ledger sequence, oversell 409 with untouched counters, reservation
  replay vs `IDEMPOTENCY_CONFLICT`, release/confirm idempotency (sold counted
  once), confirm-after-release refusal, expiry sweep returning stock,
  bootstrap create/duplicate/update-ignore.
- API (`tests/integration/inventory.test.ts`): public availability shape
  (no quantity leak) + 404/400, admin lifecycle over HTTP, idempotency-key
  replay over HTTP (one stock move), oversell/validation/transition errors,
  401 anon + 403 customer on every admin route (incl. sweep), public route
  reachable as customer, sweep expiry + resweep convergence.
- Concurrency/load (same file): 500 concurrent `reserve(qty 1)` vs stock 100
  → exactly 100 succeed, 400 get `INSUFFICIENT_STOCK`, `reserved = 100`,
  `onHand - reserved ≥ 0`. See `performance.md`.
- Regression: full suite 215/215 green (193 pre-existing + 22 new);
  `tsc` clean for new code; eslint clean for new files; `npm run build`
  passes. Pre-existing issues in untouched files unchanged.
