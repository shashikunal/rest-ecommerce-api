# 08 Checkout

```mermaid
sequenceDiagram
  C->>A: POST /checkout + Idem-Key
  A->>R: idem + limits
  A->>M: tx: reprice(server) → coupon guard → reserve inv → order PENDING + outbox
  A->>K: order.created
  A-->>C: 201 order
```
Fails: no-stock→409; pay-fail/timeout→FAILED + release reserve; dup req→replay stored resp; dup webhook→idem; order-fail→tx rollback; event-fail→outbox sweeper retries. Sync: validate/price/reserve/order. Async: notify/analytics.
