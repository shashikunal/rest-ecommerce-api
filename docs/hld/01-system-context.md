# 01 System Context

```mermaid
flowchart TB
  CU[Customer] & AD[Admin] & ST[Staff] & SU[Support] --> PLAT[E-Commerce Platform: Vercel Express /api/v1]
  PLAT --> A[(Atlas: authoritative)] & R[(Redis: ephemeral)] & K[Managed Kafka + workers]
  PLAT --> P[Payment provider] & E[SMTP] & SH[Shipper] & S[S3+CDN] & SE[Search: Atlas start] & O[Observability]
```

In: credentials, catalog queries, cart/checkout commands, idem keys, webhooks (HMAC). Out: tokens, pages, orders/shipments, emails, audit/analytics events. Untrusted: public net/clients/webhooks until verified. Trusted: VPC/managed data with IAM. Authoritative: Atlas for truth; gateway for money state (server-verified); Redis/Kafka never truth.
