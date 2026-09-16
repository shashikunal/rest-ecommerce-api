# Inventory Module — README

SKU-level stock management and the reservation primitives that Phase 15
(Checkout) will call. Source of truth: MongoDB. No Redis stock. No checkout,
order, payment, or notification logic in this module.

Collections: `inventories`, `inventory_reservations`, `inventory_movements`.
Shared outbox: `outbox_events` (same collection/mechanism as catalog, Phase 5).

Public surface:

| Method | Path                                            | Auth               | Notes                                |
| ------ | ----------------------------------------------- | ------------------ | ------------------------------------ |
| `GET`  | `/api/v1/inventory/availability?sku=`           | none               | Safe subset `{sku,available,status}` |
| `GET`  | `/api/v1/inventory?sku=&status=&limit=&cursor=` | `inventory:adjust` | Full records, cursor page            |
| `POST` | `/api/v1/inventory`                             | `inventory:adjust` | Idempotent init (201/200)            |
| `GET`  | `/api/v1/inventory/:id`                         | `inventory:adjust` | By id or SKU                         |
| `POST` | `/api/v1/inventory/adjust`                      | `inventory:adjust` | Delta-only stock changes             |
| `GET`  | `/api/v1/inventory/:id/movements`               | `inventory:adjust` | Immutable ledger                     |
| `POST` | `/api/v1/inventory/reservations`                | `inventory:adjust` | Atomic reserve, key required         |
| `GET`  | `/api/v1/inventory/reservations/:id`            | `inventory:adjust` | —                                    |
| `POST` | `/api/v1/inventory/reservations/:id/release`    | `inventory:adjust` | Idempotent                           |
| `POST` | `/api/v1/inventory/reservations/:id/confirm`    | `inventory:adjust` | reserved → sold                      |
| `POST` | `/api/v1/inventory/reservations/expire-sweep`   | ADMIN/SYSTEM       | Bounded worker boundary              |

Core invariant: `available = onHand - reserved`, with
`onHand ≥ 0`, `reserved ≥ 0`, `sold ≥ 0`, `reserved ≤ onHand` — enforced by
conditional MongoDB updates, never read-modify-write.

See: `architecture.md`, `domain-model.md`, `data-model.md`, `api.md`,
`reservation.md`, `concurrency.md`, `inventory-ledger.md`, `events.md`,
`outbox.md`, `security.md`, `failure-handling.md`, `testing.md`,
`performance.md`, `interview-preparation.md`.
