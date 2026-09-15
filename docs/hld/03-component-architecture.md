# 03 Component Architecture

```mermaid
flowchart LR
  H[HTTP] --> RT[Routes] --> MW[Middleware: corrId/limit/auth/Zod] --> CT[Controllers thin] --> SV[App Services] --> DM[Domain logic] --> RP[Repositories] --> MG[(Mongo)]
  SV -.-> RD[(Redis)] & OB[Outbox→Kafka] & EXT[Gateway/SMTP/S3]
```

Rules: HTTP→App→Domain→Infra only. No logic in routes/controllers/repos; no route→DB; domain never touches HTTP; cross-module via service iface or event. Shared kernel: corrId, errors, paging, money, time, envelope.
