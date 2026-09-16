# Inventory — Security

- Authorization: every non-public route requires `inventory:adjust`
  (STAFF/ADMIN/SYSTEM per the approved matrix; CUSTOMER lacks it → 403).
  The sweep additionally requires role ADMIN or SYSTEM. The availability
  endpoint is public but returns `{sku, available, status}` only.
- Identity: actor comes from `req.user` (JWT + session); `actorId`/`actorType`
  are never accepted from the body (strict schemas reject them as unknown
  fields, alongside `onHand/reserved/sold/version/status` anti-tamper fields).
- BOLA/IDOR: reservations have no per-user owner (they belong to references,
  not users), so all reservation routes are admin-gated rather than
  owner-scoped — the correct posture for pre-order stock primitives.
- Injection: SKU normalized (trim/upper, ≤64); ids UUID-validated except the
  `:id` locator which accepts SKU form (routed through parameterized
  `{sku} OR {_id}` lookup, no `$where`/raw operators).
- Quantity abuse: integers only (floats/NaN/Infinity → 400), reserve 1–1000,
  adjust |delta| ≤ 1 000 000, TTL clamped 60–3600s, thresholds ≥ 0.
- Replay: persisted `idempotencyKey` (unique index) + header idempotency on
  init/adjust; key reuse with different payload → 409, never silent overwrite.
- Rate limits: GET 60/min (IP), mutations 30/min, Redis-backed; fail-open
  only degrades to unthrottled, never to unauthorized.
- Errors: 400/401/403/404/409/422/429 via the standard envelope; no Mongo,
  Redis, or Kafka internals leak.
