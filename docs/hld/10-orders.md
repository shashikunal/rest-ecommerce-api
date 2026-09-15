# 10 Orders

```mermaid
stateDiagram-v2
  [*] --> CREATED --> PENDING_PAYMENT --> PAID --> PROCESSING --> SHIPPED --> DELIVERED
  PENDING_PAYMENT --> FAILED
  CREATED --> CANCELLED
  PENDING_PAYMENT --> CANCELLED
  DELIVERED --> RETURN_REQUESTED --> RETURNED --> REFUNDED
```
Guarded transitions + version; invalid (e.g., SHIPPED→CANCELLED) rejected 409. Each emits event + side-effect (reserve/pay/ship/notify/refund); retries idempotent via inbox/idem.
