# Checkout — State Machine

```text
priced ──reserve──▶ reserved ──gate──▶ ready ──complete──▶ completed (Phase 16)
  │                  │                  │
  │                  │                  ├──cancel──▶ cancelled
  │                  ├──cancel──▶ cancelled
  ├──cancel──▶ cancelled
  │
  ├──validate/reserve finds drift ──▶ failed
  │
  └──expiresAt passes ──▶ expired (reservations released)
```

Rules:

- Creation lands directly in `priced` (validate + price run synchronously;
  no persisted intermediate state is justified).
- `reserved` is transient inside the reserve saga; observable only if the
  process crashes between `setReservations` and the `ready` transition — the
  sweep treats it as expirable and releases its reservations.
- `ready` is the only state Phase 16 may complete (`ready → completed`,
  version-guarded, `orderId` recorded).
- `failed` requires a fresh checkout (money snapshots are never patched).
- Every transition is a conditional `(status, version)` update; losers get
  409 `CHECKOUT_CONFLICT`.
- No transition out of `completed | failed | expired | cancelled` exists.
