# Domain Map + Ownership

Layer per module: Route→Middleware→Controller→AppService→Domain→Repo→Mongo. Cross-cutting: corrId, Zod, error contract, RBAC, limits, idem, audit, metrics.

| Group | Modules | Owns |
|---|---|---|
| Identity | Auth,User,Role,Permission,Session,OTP | credentials, JWT rotation/reuse-detect, RBAC, OTP hashed/purposed |
| Catalog | Product,Variant,SKU,Category,Brand,Attrs,Media | variant/SKU uniqueness, media→S3/CDN refs |
| Commerce | Pricing,Tax,Coupon,Promo,Search,Cart,Wishlist,Address,Checkout,Order,Payment,Refund,Inventory,Shipping,Return,Review | server pricing, reserve/expiry, state-machine, server-verify pay |
| Platform | Notify+Prefs,Support,Admin,Audit,Analytics,Flags,Config | templates/prefs, append-only audit |
| Infra | Redis,RateLimit,Cache,Idem,Kafka,Outbox,Inbox,Obs,Sec | ephemeral vs durable rules |

Keep together in monolith: checkout+order+pay+inventory (single Mongo tx); notify/analytics/audit via events only. Extract later only if team/scale justifies (e.g., search, notify workers).
