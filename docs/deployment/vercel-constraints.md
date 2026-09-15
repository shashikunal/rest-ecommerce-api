# Vercel Constraint Audit

On Vercel: stateless handlers, Zod/auth/limits, short Mongo/Redis ops, webhook receivers (verify + write + enqueue via outbox), presigned-URL issuance. External only: Kafka brokers/consumers, outbox publisher sweeper, reserve-expiry/reconcile cron workers, mail fan-out, OTel collector. Never: in-process consumers, local disk, in-memory truth/sessions, long jobs. Controls: global client reuse, 5s/3s/10s timeouts, managed Kafka/Redis/SMTP/S3, Vercel Cron → light trigger endpoints that enqueue work for external workers.
