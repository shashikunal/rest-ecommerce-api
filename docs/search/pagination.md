# pagination

See overview.md for diagrams. Phase 12 decisions: MongoDB catalog is authoritative; ProductSearchProvider abstracts the read path; inputs are Zod/service validated; only published products with active category/brand metadata are public; Redis cache is best-effort 60s TTL; cursors are opaque signed and sort-bound; total counts are not computed; future event-driven indexing uses catalog outbox/Kafka with idempotent, version-aware consumers and rebuildable projections.
