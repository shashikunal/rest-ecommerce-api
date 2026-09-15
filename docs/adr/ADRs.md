# ADRs 001–013 (each: Context/Problem/Options/Decision/Reasons/Trade-offs/Consequences)

**001 Atlas vs Supabase/PG:** C: document catalog+variants. P: flexible attrs + single DB + Vercel. O: PG/Supabase vs Atlas. D: Atlas primary, no second primary. R: schema flex, tx, search-start, scale, DX. T: weak joins/ledger → app-level + tx. C: snapshots, indexes, PITR.
**002 Modular monolith:** C: small team, Vercel. P: avoid distributed overhead. D: monolith, strict boundaries. R: single deploy, tx. T: later extract. C: module lint rules.
**003 Redis:** ephemeral limits/OTP/cache/idem/locks only; never truth; TTL+fail-closed auth/pay.
**004 Kafka:** external managed async only (order/pay/inv/notify/audit); local Docker; outbox+inbox+DLQ.
**005 Vercel:** stateless, reuse conns, external workers/cron; no disks/consumers.
**006 JWT:** 15m access + rotate refresh + reuse-detect + revoke; httpOnly secure.
**007 OTP:** crypto, 5-10m, hashed, ≤5 tries/≤3 resends, purposed, single-use.
**008 Limits:** Redis sliding-window per IP/user/acct/route; 429+Retry-After; tuned by metrics.
**009 Outbox:** tx biz+event; publisher+sweeper; only cross-domain.
**010 Idempotency:** keys on checkout/order/pay/refund/webhook; Redis 24h + Mongo persist for money; hash-replay.
**011 Search:** Atlas text → OpenSearch path when facets/scale demand.
**012 Storage:** S3-compat+CDN presigned; never blobs in Mongo.
**013 Observability:** JSON logs, prom-metrics, OTel traces, lag/error/latency alerts.
