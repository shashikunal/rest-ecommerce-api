# LLD — Core (Auth/Session/OTP/User + Catalog/Search + Cart/Checkout/Order/Pay/Inventory)

## Auth/Session/OTP
- Resp: register/login/logout/logout-all/verify/reset/change; JWT access 15m + refresh rotate + reuse-detect (token family, denylist) + session list/revoke + device meta + throttle + security mail.
- Repo: users, sessions, Redis otp/counters. Zod all inputs; generic errors anti-enumeration; argon2/bcrypt; OTP crypto 6d, 5-10m, SHA256 stored, ≤5 tries, ≤3 resends +60s cooldown, purpose-separated single-use.
- Diagrams: register→hash→OTP→verify; login→throttle→tokens; refresh→rotate→detect-reuse→revoke-family.

## Catalog/Search
- Product+Variant/SKU (unique sku), Category/Brand/Attrs, media refs (S3 URLs). Atlas $text + compound filters; cursor paging; cache product/cat 5-15m with write-invalidate.

## Cart/Wishlist/Checkout/Order/Pay/Inventory/Coupon/Ship/Return/Notify/Admin
- Cart server-priced, merge on login; coupon validated server-side (expiry/limits/min-value/restrictions) + atomic usage inc.
- Checkout tx: reprice→coupon→reserve (atomic cond `$inc` available→reserved, 15m TTL)→create order CREATED/PENDING_PAYMENT + outbox.
- Order machine: CREATED→PENDING_PAYMENT→PAID→PROCESSING→SHIPPED→DELIVERED; branches CANCELLED/FAILED/RETURN_REQUESTED→RETURNED→REFUNDED. Table: state, valid next, actor, event, side-effect, retry/idem.
- Pay: intent→attempt ledger→gateway→webhook HMAC+timestamp→server-fetch verify→tx confirm→outbox; refunds incl. partial with guards + reconcile job. Never trust client.
- Inventory race (last item): single atomic update wins; loser gets 409; expired reserves released by sweeper; oversell impossible via conditional decrement.
- Ship/Return/RMA/Refund/Review/Notify/Admin per template: Resp/IO/DTO/Zod/Repo/Redis/Kafka/Sec/Tests. Notify async via Kafka; prefs + dedupe + DLQ.

State:
```mermaid
stateDiagram-v2
  [*] --> CREATED --> PENDING_PAYMENT --> PAID --> PROCESSING --> SHIPPED --> DELIVERED
  PENDING_PAYMENT --> FAILED
  CREATED --> CANCELLED
  PENDING_PAYMENT --> CANCELLED
  DELIVERED --> RETURN_REQUESTED --> RETURNED --> REFUNDED
```
