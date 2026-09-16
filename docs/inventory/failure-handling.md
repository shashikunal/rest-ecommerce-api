# Inventory — Failure Handling

| Scenario                                                  | Behavior                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| MongoDB down mid-reserve                                  | Conditional update fails → 503, no reservation claimed                                        |
| Reservation insert fails after stock move (non-duplicate) | Stock increment compensated, error propagates                                                 |
| Reservation insert races (duplicate key)                  | Winner replayed after compensating loser's increment; payload mismatch → 409                  |
| Movement write fails                                      | Operation fails; retry replays reservation and re-inserts movement idempotently               |
| Outbox write fails                                        | Warn-and-continue (catalog-identical posture); stock truth unaffected                         |
| Release/confirm stock step fails post-transition          | Error logged loudly; stock stays held (conservative leak, never oversell)                     |
| Duplicate reserve retry (same key)                        | Same reservation replayed, no extra stock move                                                |
| Duplicate adjust retry (same key)                         | Current record returned, ledger unchanged                                                     |
| Expired reservation used                                  | Release path → `expired`; confirm → 404 (cannot confirm)                                      |
| Sweep crash mid-batch                                     | Next sweep re-queries `active + expired`; each expiry idempotent                              |
| Redis down                                                | Idempotency/rate-limit degrade per existing policy; persisted keys still protect reservations |
| Kafka down                                                | Outbox rows stay PENDING for the Phase 25 publisher; sync responses unaffected                |
| Unknown SKU / missing record                              | 404 `INVENTORY_NOT_FOUND` (adjust never auto-creates)                                         |
| Oversell attempt                                          | 409 `INSUFFICIENT_STOCK`, counters untouched                                                  |

Transaction boundary: none spans documents (no multi-doc transactions exist
in this codebase). Atomicity unit = one conditional document update; the
reservation insert is the idempotency anchor; movement/outbox are convergent
follow-ons. Phase 15 checkout will own its own cross-document boundary and
can reuse these primitives inside it.
