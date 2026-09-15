# Domain Map (Phase 0 — authoritative)

Layer per module: `Route → Middleware → Controller → AppService → Domain → Repo → Mongo`. Side-effects via Outbox/Redis only. Shared kernel: corrId, errors, pagination, money, time. No cycles.

| Domain | Responsibility | In/Out | Deps | Data owns | Produces → Consumes |
|---|---|---|---|---|---|
| Auth | register/login/tokens/verify/reset | creds → tokens | User,Session,OTP,Redis,Mail | — (uses users/sessions) | auth.* → notify/audit |
| User/Role/Perm/Session/OTP | profile/address/RBAC/session/OTP | DTOs → records | Redis,Kafka(outbox) | users,roles,permissions,sessions | user.*, otp.* → notify |
| Product/Variant/SKU/Cat/Brand/Media | catalog + S3 refs, sku unique | admin DTO → docs | Inventory,Media | products,productVariants,categories,brands | product.* → search/cache/inv |
| Pricing/Tax/Coupon/Promo | server calc + guards | cart/coupon → totals | Cart,Order | coupons,promotions | pricing.applied → order |
| Search | text/filter/facet/sort/page | query → page | Product | — (index on product) | — |
| Cart/Wishlist/Address | merge, server-price | items → totals | Product,Pricing,Coupon | carts,wishlists,addresses | cart.* → checkout |
| Checkout | reprice+coupon+reserve+order+outbox (tx) | cart+idem → order | Cart,Inv,Order,Coupon,Idem | — (orchestrates) | order.created |
| Order | state-machine + snapshots | cmds → states | Inv,Pay,Ship | orders | order.* → pay/inv/notify/audit |
| Payment/Refund | intent/attempt/verify/webhook/refund/reconcile | order+idem → status | Order,Gateway | payments,refunds | payment.* → order/notify |
| Inventory | available/reserved/sold + expiry | reserve/release → counts | Product,Order | inventory | inventory.* → order |
| Shipping/Return | shipment/tracking/RMA/return→refund | order → labels/RMA | Order,Pay | shipments,returns | shipment.*, return.* |
| Review | verified-purchase + moderate | order → rating | Product,Order | reviews | review.* → catalog/notify |
| Notify+Prefs/Support/Admin/Audit/Analytics/Flags/Config | templates/prefs/async send; ops dashboards; append-only audit | events → messages | Kafka,SMTP | notifications,prefs,auditLogs | notify.* |
| Redis/Kafka/Outbox/Inbox/Idem/Obs | ephemeral vs durable plumbing | — | all | outboxEvents,inboxEvents,idempotencyRecords | infra events |

## Monolith boundaries
- **Allowed:** service → its domain + repo; cross-domain via service interface or event (preferred for notify/analytics/audit); checkout/order/pay/inv in shared tx where atomicity required.
- **Forbidden:** controller→repo, route→DB, domain→HTTP, cross-module table joins bypassing owner, in-memory shared mutable state, god services.
- **Shared infra:** config, logger, corrId, error, Zod, Mongo/Redis clients, event envelope, auth middleware.
- Extraction path: events + repo interfaces already isolate Search/Notify/Audit for later services.
