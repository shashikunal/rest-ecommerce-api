# Sync vs Async / Consistency / Trade-offs + Data Flows

Sync: product GET, cart validate, checkout price/reserve/order-tx, pay-initiate, webhook-verify. Async (Kafka): notify, analytics, audit, search-index. Kafka only cross-domain; never for single reads.
Strong: inventory counts, payment status, order creation (Mongo tx). Eventual: notify/analytics/search/dashboards.
Flows: register→OTP(sync+async mail); login sync; browse sync(+cache); cart sync; checkout sync tx then async events; pay sync-verify + async notify; ship/return/refund sync-state + async notify; review sync + async index.
Trade-offs: limits vs UX (tuned 429); consistency vs throughput (minimal tx); freshness vs perf (5–15m TTL, money never cached); sync latency vs async complexity.
