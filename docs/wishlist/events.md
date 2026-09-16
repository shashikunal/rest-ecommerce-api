# Wishlist — Events

No Kafka/outbox publication in Phase 13 (same rationale as cart: no consumer).
Observable via logs: `wishlist.item_added / wishlist.item_removed /
wishlist.duplicate_attempt`. If recommendations/analytics later need
`wishlist.*` signals, they go through the existing catalog outbox pattern —
no second outbox mechanism.
