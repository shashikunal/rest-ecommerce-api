# ADR-001 MongoDB Atlas vs Supabase/PostgreSQL
- **Context:** Document-heavy catalog (variants/SKU/attrs/media), order snapshots, Vercel serverless, single-team ops.
- **Problem:** One primary DB that fits catalog flexibility + tx + scale + Vercel without dual-write complexity.
- **Options:** (a) Atlas, (b) Supabase/PG, (c) both (rejected: dual primaries = sync pain).
- **Decision:** Atlas sole primary; no Supabase/PG primary.
- **Why:** Flexible schema, variant/attr fit, Mongo tx for checkout/pay/refund, Atlas Search starter, scale-out, Vercel-friendly pooling, DX.
- **Trade-offs:** Weaker ad-hoc joins/ledger constraints → enforce in app + tx + indexes.
- **Consequences:** Snapshots embedded, refs for lifecycle-split data, PITR backups, OpenSearch path later.

# ADR-002 Modular Monolith
- **Context:** Small team, Vercel, need tx across checkout/order/pay/inv.
- **Problem:** Avoid distributed-transaction overhead while keeping extraction path.
- **Options:** monolith / modular monolith / microservices.
- **Decision:** Modular monolith, strict boundaries.
- **Why:** Single deploy, Mongo tx, low ops, module lint prevents coupling.
- **Trade-offs:** Single blast radius → mitigate with tx/idem/tests/rollback.
- **Consequences:** Layer rule + allowed/forbidden deps enforced from Phase 8.

# ADR-003 Redis / ADR-004 Kafka / ADR-005 Vercel
- **Redis:** ephemeral only (cache/limits/OTP/idem/locks); TTL all; fail-closed auth/pay, fail-through cache.
- **Kafka:** external managed only; async where justified (order/pay/inv/notify/audit/analytics); outbox+inbox+DLQ; Docker local.
- **Vercel:** stateless handlers, global client reuse, external workers/cron; no consumers/disks/memory-truth.

# ADR-006 JWT / ADR-007 OTP / ADR-008 Rate Limiting / ADR-009 Outbox / ADR-010 Idempotency
- **JWT:** access 15m + rotating refresh (httpOnly/secure) + reuse-detect + denylist/revoke + session list.
- **OTP:** crypto 6-digit, 5–10m, SHA256 in Redis, ≤5 tries, ≤3 resends +60s cooldown, purpose-separated, single-use.
- **Limits:** Redis sliding-window per IP/user/acct/route (token-bucket burst for search); 429+Retry-After; tuned by metrics.
- **Outbox:** tx(biz+PENDING)→publisher→Kafka→SENT+sweeper; only cross-domain async.
- **Idempotency:** keys on checkout/order/pay/refund/webhook; Redis 24h + Mongo persist for money; request-hash replay.
