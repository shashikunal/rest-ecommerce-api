# 02 Capacity + Scaling + Hotspots + Backpressure + Perf (planning assumptions)

Base: 10k reg, 2k DAU, 20k SKU (3 variants avg), 500 orders/d (peak 5/min), 200rps avg / 800 peak, 50k req/d reads 90% / writes 10%, ~5k Kafka ev/d, 2k mails/d, DB +200MB/mo, media 5GB/mo (S3), Redis <1GB.
Calc: peak 800rps × 5KB ≈ 4MB/s edge; Atlas M10 start (M30 at 10x); p50<200ms p95<600ms reads.
10x: M30 + Redis 2GB + Kafka 3 partitions/topic + 3 workers; 100x: sharded catalog, OpenSearch, read-preference, CQRS dashboards; 1000x: multi-region, ledger split, dedicated pay/inv services (extraction).
Hotspots: hot-SKU inv doc (cond-inc + short-TTL reserve), checkout tx (keep minimal + snapshots), login/OTP keys (per-acct limits), Kafka key skew (aggregateId + partition scale). Backpressure: consumer lag alert >1k, pause + scale + DLQ poison, never retry-storm (jitter+cap). Perf: cursor paging (max 50), projection, indexes per §DB, CDN media, compress JSON, timeouts 5/3/10s.
