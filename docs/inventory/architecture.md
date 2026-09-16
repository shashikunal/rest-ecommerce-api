# Inventory — Architecture

Modular-monolith slice reusing Phase 8–13 infrastructure:

```text
routes (auth + inventory:adjust + zod + idempotency)
  → InventoryController (actor from req.user roles only)
    → InventoryService (invariants, lifecycle, orchestration)
      → MongoInventoryRepository (conditional single-doc updates)
      → MongoReservationRepository (state-guarded transitions)
      → MongoMovementRepository (append-only ledger)
      → MongoInventoryCatalogAdapter (ProductRepository + VariantRepository)
      → OutboxInventoryEventPublisher (shared outbox_events collection)
```

Supporting boundaries:

```text
VariantBootstrapHandler ── called by Phase 25 consumer on
  catalog.variantCreated (approved: event-catalog "inventory-bootstrap")
MongoInventoryLookup ── implements catalog InventoryLookup port, injected
  into catalog factory (optional param, NullInventoryLookup default);
  maps derived status to IN_STOCK / OUT_OF_STOCK, missing record → UNKNOWN
```

Deliberate non-goals: no MongoDB multi-document transactions (no existing
usage in the codebase; the single-doc conditional update is the
linearizability point — see `concurrency.md`), no inbox collection yet
(none exists; bootstrap dedupes on the unique SKU — see `outbox.md`), no
warehouse dimension (Phase 4 keys inventory by SKU; `warehouseId` is the
documented extension point), no Kafka consumer process (Vercel constraint;
sweep is an HTTP worker boundary for Phase 25).
