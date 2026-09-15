# 21 Failure Handling + Reliability + Scalability

| Dep | Detect | Timeout/Retry | Fallback | Alert/Recover |
|---|---|---|---|---|
| Atlas | probe/err rate | 5s; no blind write retry | 503; read-cache non-money | page; PITR failover |
| Redis | latency/err | 3s; fail-closed auth/pay | fail-through cache | warn; rebuild from truth |
| Kafka | lag/DLQ depth | exp-backoff+jitter 3–5 →DLQ | degrade notify/analytics | page; replay retention 7d |
| Gateway/mail/ship/S3/search/workers | 5xx/timeout | breaker + idem retry only | queue + manual reconcile | ticket; reconcile cron |

Reliability: timeouts above; retries idempotent-only; breakers on gateway/mail/search; bulkhead workers vs API; idem on money paths. Scale: serverless horizontal; Atlas indexes + tier; Redis tier + conn reuse; Kafka partitions + consumer groups; CDN media. Bottlenecks: hot SKU, checkout tx, webhook burst, consumer lag.
