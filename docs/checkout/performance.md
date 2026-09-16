# Checkout — Performance

Scenario (in-process harness, fake repositories, real `CheckoutService` +
real `InventoryService`): 200 concurrent create(+replay probe)+reserve flows,
one SKU, stock 50, qty 2 per cart.

Measured:

```text
wall=30ms n=200 ready=25 stockout=175 err=0
p50=28ms p95=29ms p99=29ms throughput≈6667 flows/s
reserved=50, 25 reservations, 25 distinct ready checkouts, 175 failed
```

Findings:

- Stock splits exactly (25 × 2 = 50 units); zero oversell, zero unexpected
  errors, every loser lands in `failed` with its stock untouched.
- These numbers are harness-relative (no I/O): production latency will be
  dominated by MongoDB conditional writes (checkout doc + inventory doc +
  reservation doc per flow) and one Redis idempotency round-trip per
  mutation. The p50≈p99 spread here confirms no serialization bottleneck in
  the orchestration code itself.
- Expected production bottleneck: hot-SKU inventory document contention
  (inherited from Phase 14) plus checkout-doc write rate. Mitigations stay
  the same: SKU partitioning when measured, short reservation TTLs, bounded
  sweep batches. Checkout adds no new hot document (one doc per attempt,
  keyed by uuid).
- No N+1: create = 1 cart read + N catalog reads + 1 insert; reserve = 1
  revalidation pass + 1 inventory op per line + 2 conditional writes. No
  caching introduced — money and stock must reflect the latest write.
