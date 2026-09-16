# Checkout — Architecture

Modular-monolith slice reusing Phase 8–14 infrastructure:

```text
routes (auth + zod + idempotency, CHECKOUT 10/m)
  → CheckoutController (userId from req.user; Idempotency-Key required on create)
    → CheckoutService (saga orchestration, no direct Mongo access to other domains)
      → MongoCheckoutRepository (conditional status+version transitions)
      → CartServiceCheckoutCartAdapter (wraps CartService, no cart internals touched)
      → MongoCheckoutCatalogAdapter (ProductRepository + VariantRepository)
      → DefaultCheckoutPricing (subtotal-only; coupon/tax/shipping hooks for Phase 20)
      → InlineCheckoutAddressResolver (snapshot validation; address-book seam)
      → UserServiceCheckoutUserAdapter (customer snapshot via getMe)
      → InventoryServiceCheckoutInventoryAdapter (reserve/release only, actor system)
```

No new database, no new outbox, no new topic, no new rate-limit policy, no
new permission (owner-scoped customer routes + ADMIN/SYSTEM sweep via
existing `requireRole`). No distributed transaction: the saga is local
orchestration with compensating releases (see `inventory-integration.md`).

```mermaid
sequenceDiagram
    participant C as Customer
    participant API as Checkout API
    participant Cart as Cart
    participant Catalog as Catalog
    participant Pricing as Pricing Boundary
    participant Inv as Inventory
    participant DB as MongoDB
    C->>API: POST /checkout + Idem-Key
    API->>Cart: Load cart
    Cart-->>API: Cart snapshot
    API->>Catalog: Validate items
    Catalog-->>API: Current catalog
    API->>Pricing: Calculate price
    Pricing-->>API: Price snapshot
    API->>DB: Persist checkout (priced)
    API-->>C: 201 Checkout
    C->>API: POST /checkout/:id/reserve
    API->>Inv: Reserve per SKU (compensate on partial fail)
    Inv-->>API: Reservations
    API->>DB: ready
    API-->>C: 200 ready
```
