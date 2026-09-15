# PHASE_ROADMAP — Dependency-aware implementation order

Status: Phase 0 COMPLETE · Phase 1 COMPLETE · Phase 2 COMPLETE · Phase 3 COMPLETE · Phase 4 COMPLETE · Phase 5 COMPLETE · Phase 6 COMPLETE · Phase 7 COMPLETE · Phase 8 COMPLETE · Phase 9 COMPLETE · Phase 10 COMPLETE · Phase 11 COMPLETE · Phase 12 COMPLETE · Phase 13 NEXT (Cart + Wishlist).

```
Requirements → Architecture → DB → API contracts → Foundation → Auth → Core domains
→ Checkout → Orders → Payments → Events → Notifications → Security → Testing → Deploy → Perf
```

| Phase | Name                   | Depends on  | Key deliverable                                                                       |
| ----- | ---------------------- | ----------- | ------------------------------------------------------------------------------------- |
| 0     | Requirements+NFR+SLO   | —           | docs/requirements/*, SLO: p50<200ms p95<600ms p99<1200ms, Avail 99.9%, RPO≤5m RTO≤30m |
| 1     | HLD                    | 0           | docs/hld/* + context/container/component/deployment Mermaid                           |
| 2     | System Design          | 1           | docs/system-design/* functional+NFR+tradeoffs                                         |
| 3     | LLD                    | 1,2         | docs/lld/* per-module interfaces/state/errors                                         |
| 4     | DB design              | 3           | docs/database/* collections/indexes/tx                                                |
| 5     | Kafka/Events           | 3,4         | docs/kafka/* topics/envelope/outbox/inbox/DLQ                                         |
| 6     | API contract           | 3-5         | docs/api/* + openapi.yaml + Swagger                                                   |
| 7     | Wireframes             | 6           | docs/wireframes/* customer+admin flows/states                                         |
| 8     | Foundation             | 6           | Express+TS+Zod+helmet+corrId+error contract+config                                    |
| 9     | Auth                   | 8,4,6       | register/login/logout/verify/reset/JWT rotation/reuse-detect                          |
| 10    | User/Session           | 9           | profile/address/session list+revoke                                                   |
| 11    | Catalog                | 8,4         | product/variant/SKU/category/brand/attributes/media                                   |
| 12    | Search                 | 11          | Atlas $text+filters/facets → OpenSearch path                                          |
| 13    | Cart/Wishlist          | 9,11        | cart server-priced, merge on login                                                    |
| 14    | Inventory              | 11          | available/reserved/sold, atomic reserve/expire                                        |
| 15    | Checkout               | 13,14       | price-authoritative + idempotency + reserve                                           |
| 16    | Orders                 | 15          | state machine + snapshot + transitions                                                |
| 17    | Payments               | 16          | provider-agnostic + server verify + webhook sig+replay                                |
| 18    | Outbox/Inbox           | 4,5,16,17   | tx-outbox publish, idempotent inbox                                                   |
| 19    | Notifications/OTP      | 18          | templates/prefs/async email, hashed OTP+limits                                        |
| 20    | Coupons/Pricing        | 11,13,15    | server calc, expiry/limits/abuse guards                                               |
| 21    | Reviews                | 11,16       | verified-purchase, moderation                                                         |
| 22    | Shipping/Return/Refund | 16,17       | shipment/tracking/RMA/refund                                                          |
| 23    | Admin                  | all domains | RBAC dashboards + audit                                                               |
| 24    | Redis cache/limit      | 8           | cache-aside+invalidation, sliding-window limits                                       |
| 25    | Workers                | 5,18        | external consumer host, retries/DLQ                                                   |
| 26    | Hardening              | 9-24        | OWASP, headers, injection, upload, secrets                                            |
| 27    | Testing                | 26          | unit→integ→contract→e2e→sec→k6                                                        |
| 28    | Docker                 | 27          | local mongo/redis/kafka/mailpit                                                       |
| 29    | CI/CD                  | 27,28       | GH Actions lint→type→test→scan→build→deploy                                           |
| 30    | Vercel prod            | 29          | conn reuse, env, cron, timeouts, externals                                            |
| 31    | Observability          | 30          | JSON logs, Prometheus-style metrics, OTel traces, alerts                              |
| 32    | Perf/scale             | 31          | indexes, pagination, CDN, async, load tests                                           |
| 33    | Audit                  | 0-32        | ADRs, tradeoffs, bottlenecks                                                          |
| 34    | Interview prep         | 33          | docs/interview/* why/alt/failures/scale                                               |

Each phase must define: Objective/Prereqs/Scope/Out-of-scope/Tasks/Files/API+DB+Redis+Kafka+Security impact/Testing/Docs/Mermaid/ADRs/Acceptance/Risks/Rollback. See docs/architecture/PHASE_TEMPLATE.md.
