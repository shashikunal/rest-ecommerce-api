# 02 Container Architecture (logical modules, one deploy)

```mermaid
flowchart LR
  WEB[Web client + CDN] --> API[Vercel: Express modular monolith]
  subgraph API
    AU[Auth/User] & CA[Catalog/Pricing/Search] & CO[Cart/Checkout/Order/Pay/Inv/Ship/Return] & NO[Notify/Admin/Audit]
  end
  API --> A[(Atlas)] & R[(Redis)] & K[Kafka+workers] & S[S3+CDN] & P[Gateway] & E[SMTP]
```

One Vercel deployment; modules are logical (Phase 0 boundaries). External workers host Kafka consumers/sweepers/cron. No module is separately deployed in v1.
