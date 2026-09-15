# 03 Request Lifecycle + Data Flow + Sync/Async + Consistency

Lifecycle: Edge → reqId/corrId → security headers → Redis limit (429+Retry-After) → authN → authZ(RBAC+owner) → Zod(400) → controller → service → domain → repo → Mongo (5s) / Redis (3s) → response + metrics/logs/trace. Error `{code,message,requestId,corrId,ts,details?}`.
Data flow: commands mutate via tx+outbox; queries read Atlas (+cache for catalog/config); events fan-out async.
Sync: product/cart/checkout-validate/price/reserve/order-tx/pay-initiate/webhook-verify (latency-bound, strongly consistent). Async: email/analytics/audit/search-index/notify (durable via Kafka, loss-intolerant but latency-tolerant).
Strong: inventory, payment status, order state, coupon usage, money ledger. Eventual: notify/analytics/search/dashboards (UX: "processing" states + reconcile on read; recovery via replay).
