# Inventory — Performance

Scenario (in-process, fake repositories mirroring the Mongo conditional
semantics exactly): 500 concurrent `reserve(sku, qty 1)` against `onHand = 100`.

Observed run:

```text
n=500 stock=100 ok=100 rejected=400 errored=0
wallMs=26 p50=25ms p95=26ms p99=26ms
onHand=100 reserved=100 sold=0
```

Findings:

- Exactly 100 reservations succeed; 400 fail fast with 409 — no oversell,
  no negative stock, `reserved ≤ onHand` holds at every interleaving the
  fake layer permits.
- In-process timings are a correctness-harness artifact, not a production
  SLO: real latency will be dominated by MongoDB conditional-update
  contention on the hot SKU document plus Redis idempotency round-trips.
- Expected production bottleneck: write contention on a single hot-SKU
  document (single-document linearizability is the cost of correctness).
  Mitigations reserved for measured need: partition hot SKUs, cap reservation
  TTL pressure via sweep frequency, and keep the lookup path (`findBySku`,
  indexed) free of the write lock.
- No N+1: every operation is O(1) indexed writes plus one indexed read;
  list/ledger paths are cursor-bounded (≤50). No caching introduced —
  availability must reflect the latest committed write.
