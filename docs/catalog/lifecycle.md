# Lifecycle

Product: `draft → published (guard: ≥1 active variant) → draft|archived`;
`draft → archived`. Archived is terminal and sets `deletedAt` (soft delete —
orders/carts/reviews/analytics keep working; nothing is hard-deleted).

Variant: `active ↔ discontinued` (status-only update, no dedicated endpoints).
Variant deletion is allowed for draft products only — published assortments are
stable for order snapshots.

Category/Brand: `active → archived` via `POST /:id/archive`, guarded by
reference checks (`409 CATEGORY_IN_USE`).

Illegal transitions yield `422 INVALID_TRANSITION`; stale `version` yields
`409 CONCURRENT_UPDATE`. Raw `PATCH {status}` is rejected by strict schemas —
state changes go through action endpoints so guards, events, and cache
invalidation always run.
