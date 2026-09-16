# Checkout Module — README

Purchase orchestration: cart snapshot → validate → price → reserve → ready.
Stops at `READY_FOR_ORDER`; Order (Phase 16) and Payment (Phase 17) consume
the handoff. Source of truth: MongoDB (`checkouts`). No Kafka events in this
phase (no approved checkout topic or consumer — see `events.md`).

| Method  | Path                            | Notes                                                      |
| ------- | ------------------------------- | ---------------------------------------------------------- |
| `POST`  | `/api/v1/checkout`              | Create from cart, Idempotency-Key required, 201/200 replay |
| `GET`   | `/api/v1/checkout?limit&cursor` | Own checkouts                                              |
| `GET`   | `/api/v1/checkout/:id`          | Owner read                                                 |
| `POST`  | `/api/v1/checkout/:id/validate` | Dry-run revalidation, 200 ok / 422 issues                  |
| `POST`  | `/api/v1/checkout/:id/reserve`  | Saga reserve with compensation → ready                     |
| `PATCH` | `/api/v1/checkout/:id/address`  | Version-guarded address snapshot replace                   |
| `POST`  | `/api/v1/checkout/:id/cancel`   | Idempotent cancel + release                                |
| `POST`  | `/api/v1/checkout/expire-sweep` | ADMIN/SYSTEM worker boundary                               |

Rate limit: existing `CHECKOUT` 10/min policy (no new policy needed).

See: `architecture.md`, `domain-model.md`, `data-model.md`, `api.md`,
`state-machine.md`, `pricing.md`, `inventory-integration.md`,
`concurrency.md`, `idempotency.md`, `failure-handling.md`, `events.md`,
`outbox.md`, `security.md`, `testing.md`, `performance.md`,
`interview-preparation.md`.
