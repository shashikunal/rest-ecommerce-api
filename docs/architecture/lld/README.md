# LLD Index (Phase 3 — implementation-ready, design only)

Reading order: README → module-catalog → layers-auth → rate-limiting-redis → commerce-lld → messaging-lld → data-lld → ops-lld → diagrams → review.
Prior docs (`docs/lld/core.md`, Phase 0–2) remain authoritative for why; these files define the what/how for implementation without writing application code. No microservices; domain stays infra-independent.

# Module Architecture + Dependency Rules (condensed)

Package shape per module: `interface/{routes,controllers,middleware} · application/{services,commands,queries,DTOs} · domain/{entities,value-objects,services,policies,state-machines,events} · infrastructure/{repositories,adapters}`.
Direction: HTTP → Application → Domain ← Infrastructure. Domain never imports Express/Mongo/Redis/Kafka/Nodemailer/HTTP.
Allowed: Controller→AppService; AppService→Domain + RepoInterface; Infra→Domain interfaces + vendors; cross-module via public app interface or integration event.
Forbidden: Controller→Mongo/Redis/Kafka; Domain→any infra; Product mutating Order internals; Payment mutating Inventory internals; direct table-join bypassing owner; shared mutable globals.
Cross-module: use-case call for sync (checkout→pricing/inventory via interfaces) else domain→integration event via outbox (order.paid → notify/audit).
