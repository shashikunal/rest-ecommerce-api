# Module Catalog (responsibility · interface · deps · persistence · events · tx)

Conventions: each row = public app interface; internal components in parens; Tx marks Mongo-tx boundary.
- auth: register/login/refresh/logout(-all)/verify/reset/change (AuthService, TokenService, SessionService; entities UserCred, Session, TokenFamily) → deps users/sessions/OTP/Redis/mail; forbids touching catalog/order tables; persists via users/sessions repos; emits user.registered/password.changed; consumes otp.verified; Tx: refresh-rotate, reset-change.
- users/sessions/OTP: profile/address/RBAC/session-CRUD/OTP-generate-verify (UserService, RbacPolicy, OtpService) → owns users/roles/permissions/sessions; emits user.*, session.revoked.
- products/categories/brands/variants-SKU/media: admin CRUD, publish/archive, slug, presigned media (CatalogService, SkuPolicy) → owns products/productVariants/categories/brands; refs inventory; emits product.*.
- search: query parser + Atlas query builder (SearchService, read-only) → consumes product.*; no writes.
- pricing/promotions/coupons: quote(order-draft)→totals; validate-coupon atomic (PricingService, CouponPolicy) → owns coupons/promotions; emits coupon.redeemed; Tx: usage-inc with checkout.
- cart/wishlist/addresses: cart-CRUD/merge/validate/price-refresh (CartService) → owns carts/wishlists/addresses; reads catalog/pricing/coupon; Tx: merge-on-login.
- checkout: orchestrate validate→price→coupon→reserve→intent→order→outbox (CheckoutOrchestrator) → deps cart/pricing/inventory/order/payment/idem; Tx: reserve+order+outbox atomically; emits order.created.
- inventory: adjust/reserve/release/commit (InventoryService) → owns inventory; cond-inc + version; emits inventory.*.
- orders: create/transition/cancel (OrderService + OrderMachine) → owns orders; emits order.*; Tx: creation + pay-confirm.
- payments/refunds: intent/authorize/capture/webhook-verify/refund/reconcile (PaymentService, ProviderAdapter) → owns payments/refunds; emits payment.*; Tx: confirm + refund.
- shipping/returns: shipment/track/RMA/inspect (ShippingService, ReturnService + machines) → owns shipments/returns; emits shipment.*, return.*.
- reviews: create/moderate (ReviewService) → owns reviews; verified-purchase check via orders iface.
- notifications: template/send/prefs (NotifyService + channel adapters) → owns notifications/prefs; consumes notification.send; idempotent send.
- audit/analytics/admin/support: append/query (AuditService, read-only) → consumes *.events via inbox; audit append-only.
- infra: database/redis/kafka/outbox/inbox/email/storage/observability/config/security/rate-limit — implementations only, expose interfaces; outbox publisher + inbox dispatcher live in external workers (never Vercel request path).
Extraction candidates later: search, notify, audit/analytics (already event-isolated).
