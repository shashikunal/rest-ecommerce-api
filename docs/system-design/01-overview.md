# 01 System Overview (canonical)

```mermaid
flowchart TB
  U[Customer/Admin] --> CDN[CDN/Edge] --> V[Vercel: Express /api/v1]
  V --> SEC[Security: Helmet/CORS/limits/authN/authZ/Zod]
  SEC --> MOD[Domain modules: Identity/Catalog/Commerce/Platform]
  MOD -- sync --> A[(Atlas: persistent truth)]
  MOD -- sync coord --> R[(Redis: ephemeral)]
  MOD -- async via outbox --> K[Kafka → external workers]
  MOD --> S[S3+CDN] & P[Gateway] & SH[Shipper] & E[SMTP] & O[OTel backend]
```

Sync paths: reads, cart/checkout-tx, pay-verify, webhook-receive. Async: notify/analytics/audit/search-index via Kafka. Trust: internet untrusted → edge → API → data (IAM). Persistent: Atlas (+gateway money truth). Temporary: Redis/Kafka-transit.
