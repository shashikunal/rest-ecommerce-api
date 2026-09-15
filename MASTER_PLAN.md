# MASTER_PLAN — Production-Grade E-Commerce Platform (Modular Monolith, Vercel-first)

> Planning only. No implementation in this phase.
> Stack: Node.js + TypeScript + Express + REST + Zod + OpenAPI/Swagger | MongoDB Atlas (primary) | Redis (ephemeral/coordination) | Kafka (external managed, async events) | Nodemailer+SMTP (Mailpit local) | Vercel (primary deploy)

## 1. What we are building
Modular monolith Express API (`/api/v1`) with strict domain boundaries (Auth/User/Product/Cart/Checkout/Order/Payment/Inventory/Shipping/Return/Coupon/Notification/Admin/Audit/Analytics/Config/FeatureFlags), event-driven via Outbox→Kafka→Inbox where cross-domain consistency requires it, Redis for rate-limit/OTP/idempotency/cache, MongoDB Atlas as sole primary DB, Vercel serverless-first.

## 2. Why this way
- Modular monolith: low ops cost, single deploy, ACID transactions within MongoDB where needed, clean extraction path to services. No premature microservices/K8s/ES.
- MongoDB Atlas: document catalog (variants/SKUs/attributes/media/pricing snapshots), flexible schema, transactions (4.0+), Atlas search start, scale-out, Vercel-friendly (no connection-heavy RDBMS pooling pain). See `docs/adr/ADR-001-*`.
- Redis ephemeral only: distributed counters/limits/locks/idempotency/cache. Never primary truth.
- Kafka external only: durable cross-domain async (order/payment/inventory/notification/audit/analytics). Never on Vercel; local Docker for dev, Confluent/Redpanda/Upstash-managed in prod + external worker (Railway/Render/Fly/EC2/Cloud Run) for consumers.
- Vercel-first: every decision checked against serverless constraints (no in-process consumers, no in-memory state, no local disk, short timeouts, connection reuse).

## 3. Priority order
Correctness → Security → Reliability → Maintainability → Observability → Scalability.

## 4. Phase order (dependency-aware)
0 Requirements+Arch foundation → 1 HLD → 2 System Design (NFR/SLO) → 3 LLD → 4 DB design → 5 Event/Kafka design → 6 API contract+Swagger → 7 Wireframes → 8 Backend foundation → 9 Auth → 10 User/Session → 11 Catalog → 12 Search → 13 Cart/Wishlist → 14 Inventory → 15 Checkout → 16 Orders → 17 Payments → 18 Outbox/Inbox+Events → 19 Notifications/Email/OTP → 20 Coupons/Pricing → 21 Reviews → 22 Shipping/Returns/Refunds → 23 Admin → 24 Redis/Cache/Rate-limit → 25 Background workers → 26 Security hardening → 27 Testing → 28 Docker → 29 CI/CD → 30 Vercel prod → 31 Observability → 32 Perf/scale → 33 Arch audit → 34 Interview prep.
Full tasks/acceptance per phase: see PHASE_ROADMAP.md + docs/*.

## 5. Non-negotiables checklist
Atlas, Redis (limit/OTP/idempotency/cache), Kafka+Outbox+Inbox+DLQ, idempotency (checkout/order/pay/refund/webhook), per-endpoint Redis sliding-window limits + fail-closed on auth/pay, JWT short access + rotating refresh + reuse detection + revocation, RBAC + resource-authz, variants/SKU, pricing server-authoritative + snapshots, cart/wishlist, inventory reservation+expiry, order state machine, provider-agnostic payments (server verify only), refunds, shipping/returns, reviews, notifications async, Atlas search → OpenSearch path, S3-compatible storage+CDN, OWASP, versioning, OpenAPI+Swagger, error contract + correlationId, timeouts/retries/backoff/jitter/circuit-breaker, OTel logs/metrics/traces + Kafka-lag alerts, DR (Atlas PITR, RPO/RTO), unit→e2e→security→load, CI/CD, Docker dev, Vercel, HLD/LLD/Mermaid/wireframes/ADRs/interview.
