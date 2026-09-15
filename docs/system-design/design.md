# System Design (interview-quality)

## Capacity (assumptions)
10k MAU, 2k DAU, 200 rps avg / 800 peak; 20k SKU, 500 orders/d; 5k Kafka ev/d; Redis <1GB; Atlas M10 start → scale M30 + indexes; storage +5GB/mo (media in S3, not Mongo).

## Scaling
Horiz: Vercel concurrency + workers replicas + Kafka partitions; Vert: Atlas/Redis tiers. Stateless API; sticky-free; cursor paging; CDN for media/reads.

## Availability/Reliability
99.9% target; retries with exp-backoff+jitter only on idempotent GET/consumers; timeouts (API 5s DB, 3s Redis, 10s gateway); circuit-breaker on gateway/mail/search; degrade: cache-through reads, queue notify, manual reconcile. DLQ + replay.

## Consistency
Strong (Mongo tx): checkout reserve, pay-confirm, refund. Eventual: notify/analytics/audit/search-index via Kafka+inbox dedupe.

## Bottlenecks/Trade-offs
Hot SKU contention → atomic reserve + short Redis lock only if proven; checkout tx size → keep minimal + snapshots; Kafka lag → partition/consumer scale + alerts; Atlas connections → global reuse + limit. Chose monolith+Atlas over PG/microservices for ops simplicity and document fit; ES deferred.
