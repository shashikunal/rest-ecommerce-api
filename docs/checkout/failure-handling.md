# Checkout — Failure Handling

| Failure                          | Expected behavior                                                            |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Cart unavailable / empty         | `CART_EMPTY` 422, no checkout created                                        |
| Product/variant unavailable      | `ITEM_UNAVAILABLE` 422, no checkout created                                  |
| Price changed (validate/reserve) | Checkout marked `failed`; 422/409 with sku detail                            |
| Cart changed mid-checkout        | `CART_CHANGED` 409, checkout marked `failed`                                 |
| Inventory unavailable            | No `ready`; partial successes compensated; original 409 propagates           |
| Partial reservation failure      | Compensating releases, then `failed`                                         |
| Redis unavailable                | Existing fail-open policy; persisted keys still protect creates/reserves     |
| Kafka unavailable                | N/A — checkout publishes no events (outbox untouched)                        |
| MongoDB failure                  | Conditional writes fail closed; no false success                             |
| Client timeout + retry           | Same key replays (header or persisted layer)                                 |
| Duplicate request                | Idempotent (200 replay, never a second checkout)                             |
| Checkout expires                 | Reservations released; `expired`; further mutations → 409 `CHECKOUT_EXPIRED` |
| Cancel twice                     | Second is a 200 replay, no second release                                    |
| Concurrent update                | 409 `CHECKOUT_CONFLICT` (status+version guard)                               |
| Sweep crash mid-batch            | Next sweep re-queries; per-checkout expiry idempotent                        |
