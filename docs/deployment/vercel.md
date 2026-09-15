# Security + Auth flows + Kafka/Outbox + Payments + API + Obs + Test + Deploy + DR + Wireframes + Interview

## Security
RBAC (customer/staff/support/admin/system) + owner-checks; JWT 15m/rotate/reuse-detect/revoke; Helmet/CORS-allowlist/CSP; CSRF SameSite+token for cookies; XSS escape; Zod anti-NoSQLi; body 100kb (1mb media-meta); MIME/size upload checks → S3 presigned; HMAC webhook+5m window+idem; secrets in manager; audit+security events; npm audit/Snyk/CodeQL/ZAP. Threats mapped: brute/stuffing/ATO/OTP/JWT-hijack/injection/XSS/CSRF/spoof/replay/escalation/price-tamper/coupon/race/double-pay/scrape/DDoS → throttle/limits/hashing/rotation/generic-errors/server-pricing/atomic-reserve/sig+idem/WAF.

## Auth sequences
Register→OTP→verify; Login→throttle→tokens; Refresh→rotate→reuse→revoke-family; Logout(-all)→denylist; Reset→OTP→change→revoke others. (Mermaid in LLD.)

## Kafka/Outbox/Inbox
Envelope: eventId/type/version/occurredAt/producer/corrId/causationId/aggregateId/payload/meta. Topics: order.created/paid/cancelled, payment.succeeded/failed, inventory.reserved/released, notification.send, audit.record, analytics.track (+.DLQ). Key=aggregateId; retries exp+jitter 3-5→DLQ; inbox dedupe; retention 7d; schema v+compat; lag alerts. Outbox tx (biz+PENDING)→publisher→Kafka→SENT; sweeper+cleanup+monitor; only cross-domain.

## Payments
Intent→attempt→gateway→webhook verify (sig+server fetch)→tx confirm→outbox; failure→FAILED+release; refund/partial guarded+idem; reconcile cron.

## API contracts (→OpenAPI)
Per domain: method/path/authZ/req-res/Zod/errors/429/idem/events. e.g. POST /checkout (auth, 10/m, Idem-Key, 201/409/429) → order.created; POST /payments/webhook (sig, idem) → payment.*. Error {code,message,status,requestId,corrId,details?,ts}.

## Observability/Testing/Deploy/DR
Logs JSON+corrId; metrics req/err/p50-99/DB/Redis/lag/consumer/429/auth/pay/checkout; OTel API→Mongo→Redis→Kafka→notify; alerts err>2%, p95>1s, lag>1k, infra/auth/pay spikes. Tests: unit→integ→Supertest+contract→Playwright E2E (register→refund)→sec matrix→k6. GH Actions gates → Vercel preview/prod + rollback; Docker local only. DR: PITR RPO≤5m RTO≤30m, Kafka replay, Redis rebuild, runbook drills.

## Wireframes/Interview
Customer 20 + Admin 17 screens; states loading/empty/error/success/401/429; flows in docs/wireframes. Interview maps: Mongo→model/tx, Redis→limits/cache, Kafka/outbox/inbox→consistency, checkout/inventory→races, pay→idem, JWT/RBAC→sec, Vercel→serverless, obs→ops + likely SD questions.
