# 12 Kafka

Topics: order.created/paid/cancelled, payment.succeeded/failed, inventory.reserved/released, notification.send, audit.record, analytics.track (+.DLQ). Key=aggregateId; partition by key; group per consumer; retries exp+jitter 3–5→DLQ; retention 7d; versioned envelope; lag alerts.
```mermaid
flowchart LR
  O[Order svc] --> K[Kafka]
  K --> E[Email] & A[Analytics] & I[Inventory] & AU[Audit]
```
 Producers: checkout/order/pay. Consumers: notify/analytics/audit/inv-projector (external workers).
