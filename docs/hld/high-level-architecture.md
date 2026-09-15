# HLD — High-Level + Component + Deployment + Security

## High-level
```mermaid
flowchart LR
  RT[Routes] --> MW[Middleware: corrId/limit/auth/Zod]
  MW --> CT[Controllers thin]
  CT --> SV[App Services]
  SV --> DM[Domain logic]
  DM --> RP[Repositories]
  RP --> MG[(Mongo)]
  SV -.-> RD[(Redis)]
  SV -.-> OB[Outbox→Kafka]
```

## Components
Modules per domain-map; shared kernel only for corrId/errors/pagination/money/time. No cycles, no god service.

## Deployment (Vercel-first)
```mermaid
flowchart TB
  CDN[CDN/Frontend] --> V[Vercel serverless API]
  V --> A[Atlas] & R[Upstash/Managed Redis] & K[Managed Kafka]
  K --> W[External workers: Railway/Render/Fly]
  V --> S[S3+CDN] & E[SMTP] & P[Gateway]
```
Vercel: reuse clients via global, no consumers/disks/memory-limits assumed; timeouts noted; cron via Vercel Cron → lightweight sweep endpoints + workers.

## Security boundary
Edge (TLS/CORS/Helmet/429) → identity (JWT rotation/revoke, OTP, throttle) → authZ (RBAC+owner checks) → data (validate/sanitize, HMAC webhooks, encrypted secrets, audit). See docs/security.
