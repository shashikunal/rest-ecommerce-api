# 06 Commerce Domains (catalog/search/cart/pricing/inventory/checkout/orders/payments/refunds/shipping/returns/notifications)

- Catalog: product→variants/SKU(unique)/attrs/media(S3 URLs); lifecycle draft→published→archived (soft-delete); sku ownership per variant.
- Search: Atlas $text + filters/facets/sort + cursor page; migrate to OpenSearch when p95>600ms or ranking needs.
- Cart: user-owned (+guest→merge on login), 30d expiry, server-reprice on read/checkout, inv pre-check; concurrent writes last-write-wins per line with version.
- Pricing: base→variant→promo→coupon→tax→shipping = total; server-only; precedence promo>coupon caps; rounding half-up minor units; snapshot items+totals+address into order (history immune to later changes).
- Inventory: AVAILABLE→RESERVED(15m)→SOLD / →RELEASED; atomic cond-inc; tx checkout; sweeper expiry; oversell impossible.
- Checkout seq: validate cart → price → coupon guard → reserve → order PENDING_PAYMENT + outbox → pay → confirm → events → async notify. Failures: 409 stock, FAILED+release pay-fail, tx rollback order-fail, sweeper event-fail.
- Orders: state machine (HLD-10) + item/price/address snapshots + pay/inv links; invalid transitions 409.
- Payments: intent→attempt→gateway→webhook(HMAC+window+idem)→server-fetch→tx confirm; dup/out-of-order via version+idem; reconcile cron; refund/partial guarded + idem + provider-settle check.
- Shipping: provider interface (create/track/webhook), shipment per order, tracking events → order SHIPPED/DELIVERED. Returns: DELIVERED→RETURN_REQUESTED→(approve→pickup→inspect)→RETURNED→REFUNDED; partial items/refunds; dup guarded by RMA idem.
- Notifications: event→Kafka→consumer→template+prefs→email; dedupe/retry/DLQ/status/audit.
