# Requirements — E-Commerce Platform

## Product Vision
Production-grade, Vercel-deployable modular-monolith e-commerce API + ops surface, interview-ready and portfolio-demonstrable. Correctness → Security → Reliability → Maintainability → Observability → Scalability.

## Goals
- Full commerce loop: browse→search→cart→checkout→pay→order→ship→deliver→return→refund + reviews/notifications/admin/audit.
- Server-authoritative pricing, atomic inventory, idempotent money paths, event-driven cross-domain via outbox/Kafka/inbox.
- Redis distributed limits/OTP/cache/idem; Atlas sole primary DB; provider-agnostic payments/mail/storage.
- OpenAPI+Swagger, structured errors, correlation IDs, OTel observability, GH Actions → Vercel.

## Non-Goals (v1)
No microservices/K8s/service-mesh, no ES/OpenSearch day-1 (Atlas Search start), no native mobile, no multi-region active-active, no complex saga orchestration, no second primary DB.

## Actors
- **Customer:** register/login/OTP/profile/addresses/browse/search/cart/wishlist/checkout/pay/orders/returns/refunds/reviews/notifications.
- **Admin:** catalog/brand/inventory/orders/users/coupons/promos/reviews/returns/refunds/shipping/analytics/config/audit.
- **Staff/Ops:** limited RBAC ops (fulfilment, RMA triage). **Support:** read orders/users, issue refunds per policy, no config change.
- **System:** cron/sweepers (reserve-expiry, outbox publisher, reconcile), event consumers. **Externals:** gateway, SMTP, shipper, S3/CDN, Kafka, Redis, search-future.

## Functional Requirements (abridged)
Auth/session/OTP/verify/reset; RBAC+resource-authz; catalog variant/SKU/attrs/media; pricing/tax/coupon/promo server-side; search/filter/facet/sort; cart merge; wishlist; checkout→reserve→pay→order; order state-machine; payment attempt/webhook-verify/refund(partial); shipment/tracking; RMA/return/refund; reviews (verified-purchase+moderation); notifications prefs/templates multi-channel (email day-1 async); admin CRUD+analytics; audit append-only; flags/config; idempotency on checkout/order/pay/refund/webhooks.

## NFR (Requirement vs Assumption vs Future)
- **Req:** Avail 99.9% API; p50<200ms p95<600ms p99<1200ms reads; checkout/pay p95<1200ms; RPO≤5m RTO≤30m; TLS; OWASP; audit.
- **Assumption (capacity):** 10k MAU start, 2k DAU, 200rps avg / 800 peak, 20k SKUs, 500 orders/day start; Kafka ~5k ev/day; Redis <1GB. Mark all as estimates to validate.
- **Future:** OpenSearch, SMS/push, multi-currency, multi-region, ML ranking.
