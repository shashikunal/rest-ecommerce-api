# HLD Reading Index

Order: 01 context → 02 containers → 03 components → 04 domains → 05 lifecycle → 06 limits → 07 auth → 08 checkout → 09 inventory → 10 orders → 11 payments → 12 kafka → 13 outbox → 14 redis → 15 caching → 16 notifications → 17 search → 18 media → 19 security → 20 observability → 21 failure → 22 deployment → 23 DR → 24 sync-async-consistency.
All files 01–24 present; Vercel audit at `docs/deployment/vercel-constraints.md`.

# Vercel Constraints (audit)

Runs on Vercel: stateless Express handlers, Zod/auth/limits, Mongo/Redis short ops, webhook receivers (verify+enqueue), outbox write (tx). External only: Kafka brokers/consumers, sweepers/cron workers, mail sending retries, reconcile jobs, OTel collectors. Never: in-process consumers, local disk/memory truth, long jobs. Mitigation: global client reuse, short timeouts, managed Kafka/Redis, workers on Railway/Render/Fly + Vercel Cron → light triggers.
