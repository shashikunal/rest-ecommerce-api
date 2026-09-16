# Inventory — Reservation Lifecycle

```text
AVAILABLE
   ↓ reserve (atomic: available >= qty → reserved += qty)
ACTIVE RESERVATION (expiresAt = now + ttl, default 15m, max 1h)
   ├── confirm → CONFIRMED (reserved → sold, onHand -= qty)
   ├── release → RELEASED (reserved -= qty, stock back)
   └── sweep  → EXPIRED  (same stock effect as release)
```

`RELEASED / EXPIRED / CONFIRMED` are terminal: `RELEASED → CONFIRMED` and
every other post-terminal transition is rejected (confirm on a non-active
reservation → 404; release on any terminal state → idempotent replay).

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Inventory API
    participant S as Inventory Service
    participant DB as MongoDB
    participant O as Outbox
    participant K as Kafka
    C->>API: POST /reservations {sku, qty, idempotencyKey}
    API->>S: reserve()
    S->>DB: findOneAndUpdate available>=qty, $inc reserved
    DB-->>S: Updated (or null → 409)
    S->>DB: insert reservation (unique idemKey)
    DB-->>S: Created (or dup → replay winner)
    S->>DB: append movement + outbox event
    S-->>API: {reservation, inventory}
    API-->>C: 201
    O->>K: inventory.reserved (async publisher)
```

Expiration (no resident worker — Vercel constraint):

```mermaid
flowchart LR
    EX[expiresAt reached] --> SW[sweep: find ACTIVE expired, ≤500/batch]
    SW --> R[idempotent release → EXPIRED]
    R --> EV[inventory.released reason=expired]
    SW --> NX[next sweep resumes; crash-safe]
```

Phase 25 wires a scheduler to `POST /inventory/reservations/expire-sweep`
(or calls `expireReservations` directly); the sweep is re-entrant and each
expiry is individually idempotent, so overlapping or crashed runs converge.
