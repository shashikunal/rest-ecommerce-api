# Events README (Phase 5 — Kafka design, no code)

Principle: Kafka only where async adds value (notifications, analytics, search-index, audit pipeline, order/pay/inventory reactions, fulfillment, future services). Request/response stays sync (reads, cart/checkout-tx, pay-verify). Every event below has a named consumer + reason; no decorative events.
Domain events (internal facts: `InventoryReserved`) are mapped to versioned integration events (`inventory.reserved.v1`) at module boundary by the owning service; only integration events cross Kafka. Internal domain details never leak into payloads.
Delivery: at-least-once everywhere; effectively-once via inbox + idempotent handlers + tx. Exactly-once is NOT claimed.
Files: event-catalog → envelope → topic-design → producer-consumer → outbox-inbox → reliability → ops → flows → matrices → interview-review. Prior docs (`docs/kafka/plan.md`, LLD messaging-lld, Phase 4 outbox/inbox schemas) remain consistent parent decisions; this tree is the implementation-ready detail.
