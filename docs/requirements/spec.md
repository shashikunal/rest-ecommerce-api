# Requirements Specification (Phase 0 — authoritative)

## Product Vision
Production-grade, Vercel-deployable modular-monolith e-commerce platform: correct, secure, reliable, maintainable, observable, scalable — in that order. Interview-ready and portfolio-demonstrable.

## Business Goals (P0)
- Complete commerce loop: browse → search → cart → checkout → pay → order → ship → deliver → return → refund, with reviews, notifications, admin, audit.
- Trust: server-authoritative pricing, no oversell, no double-charge, auditable money paths.

## Technical Goals (P0)
Single deploy; Atlas sole primary DB; Redis ephemeral; Kafka async only where justified; OpenAPI+Swagger; corrId + error contract; OTel; GH Actions → Vercel.

## Non-Goals (P2/Future)
Microservices, K8s, service mesh, ES/OpenSearch day-1, native apps, multi-region active-active, saga orchestration, second primary DB, ML ranking, SMS/push day-1.

## Target Users / Actors
- **Customer:** register/login/OTP/profile/addresses/browse/search/cart/wishlist/checkout/pay/orders/track/return/refund/review/notify prefs.
- **Admin:** catalog/brand/variant/inventory/orders/users/coupons/promos/reviews/returns/refunds/shipping/analytics/config/audit.
- **Staff/Ops (RBAC subset):** fulfilment, RMA triage. **Support:** read orders/users, policy-bound refunds, no config.
- **System:** sweepers (reserve-expiry, outbox publisher, reconcile), event consumers. **Externals:** gateway, SMTP, shipper, S3/CDN, Kafka, Redis, future search.

## Functional Requirements (P0 unless noted)
FR-1 identity: register/login/logout/logout-all/verify/reset/change, sessions list/revoke. FR-2 RBAC + resource-authz. FR-3 catalog: product/variant/SKU/category/brand/attrs/media(S3 refs). FR-4 pricing/tax/coupon/promo server-side + order snapshots. FR-5 search/filter/facet/sort (Atlas start). FR-6 cart merge + wishlist + addresses. FR-7 checkout→reserve→pay→order with idempotency. FR-8 order state-machine. FR-9 payments: attempt ledger, webhook-verify, refund/partial, reconcile. FR-10 inventory reserve/expiry/release. FR-11 shipment/tracking, RMA/return/refund. FR-12 reviews verified-purchase + moderation (P1). FR-13 notify async (email day-1) + prefs/templates/dedupe. FR-14 admin + append-only audit + flags/config. FR-15 idempotency on checkout/order/pay/refund/webhooks.

## NFRs
- **Requirement:** Avail 99.9%; p50<200ms p95<600ms p99<1200ms reads; checkout/pay p95<1200ms; RPO≤5m RTO≤30m; TLS; OWASP; audit; PITR.
- **Assumption (validate):** 10k MAU, 2k DAU, 200rps avg/800 peak, 20k SKU, 500 orders/d, ~5k Kafka ev/d, Redis <1GB, Atlas M10→M30.
- **Constraint:** Vercel serverless (no in-process consumers, no disk/memory persistence, short timeouts, reuse conns); managed Kafka/Redis; Mailpit local.
- **Future:** OpenSearch, SMS/push, multi-currency, multi-region.

## Priority map
P0: FR-1–11, FR-13(email), FR-14, FR-15, NFR-requirements. P1: reviews-moderation, analytics-lite, flags. P2: all Non-Goals.
