# 23 Disaster Recovery

Targets (assumptions): RPO ≤ 5m, RTO ≤ 30m. Atlas continuous backup + PITR; Kafka 7d retention + replay runbook; Redis ephemeral — rebuild from Atlas, no restore SLA; Vercel instant rollback; dependency outage → degrade per doc 21. Drill quarterly: restore staging from PITR + replay Kafka + verify orders/payments reconcile.
