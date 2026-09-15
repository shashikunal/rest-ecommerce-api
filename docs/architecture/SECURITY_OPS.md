# Security + Rate limiting + Auth/OTP + Payments + Observability + DR + Testing + Deploy

## Security — docs/security/PLAN.md
OWASP API Top10; RBAC (customer/admin/staff/support/system) + resource-authz (owner/admin); JWT 15m access, refresh rotate+reuse-detect+revoke; bcrypt/argon2 passwords, SHA256 OTP hashes; brute-force/account-enumeration guards (generic messages); helmet+CORS allowlist+headers; CSRF: SameSite+token for cookie flows, stateless bearer otherwise; XSS escape+CSP; NoSQL-injection via Zod allowlist+sanitize; body 100kb/1mb media limits; MIME+size upload validation; webhook HMAC sig+timestamp+replay window; secrets in env/manager, TLS everywhere, Atlas encryption-at-rest; audit logs+security events; Dependabot+Snyk/npm audit+SAST (CodeQL/Semgrep), DAST (ZAP) pre-prod. Threats: stuffing/brute/OTP abuse/ATO/JWT theft/session hijack/injection/XSS/CSRF/CORS/webhook spoof/replay/price tamper/coupon abuse/race/double-pay/escalation/scraping/DDoS — each mapped to control+test.

## Rate limiting — docs/rate-limiting/PLAN.md
Redis sliding-window (+token bucket for burst on search). Keys by ip/user/acct/endpoint/method/key. Start: global 100-300/m/IP; login 5/15m per IP+acct; register 10/h/IP; OTP req 3-5/10m/contact; OTP verify 5/OTP; pwd-reset 3/15m/acct; search 60/m/user; cart 60/m; checkout 10/m/user; payment 5/m/user; admin 60/m + stricter; upload 10/h; webhook per-provider + sig. Headers RateLimit-*, 429+Retry-After. Tune via metrics (429 rate, p95, abuse). Monitor/alert spikes.

## Auth/OTP — docs/security/AUTH_OTP.md
Register→hash pw→verify email OTP; login throttle+lock; access/refresh rotation; session list/revoke; email-verify/pwd-reset/change; security notify async. OTP: crypto-random 6-digit, 5-10m, hashed in Redis, attempt≤5, resend≤3+cooldown 60s, purpose-separated (EMAIL_VERIFICATION/LOGIN/PASSWORD_RESET/PHONE_VERIFICATION), single-use+invalidate, audit+abuse monitor.

## Payments — docs/architecture/PAYMENTS.md
Provider interface (create/verify/refund/webhook); server-calc amount; attempt ledger; webhook sig+idempotency+server fetch verify; never trust client; retries only on safe states; partial/multiple refunds guarded; reconciliation job.

## Observability — docs/observability/PLAN.md
JSON logs+corrId; metrics (req/err/lat p50/95/99, DB/Redis latency, Kafka lag/fails, 429/auth/pay/checkout fails); OTel traces API→Mongo→Redis→Kafka→notify; alerts (err>2% 5m, p95>1s, lag>1000, Redis/DB fail, auth-spike, pay-fail spike, inventory anomaly) via PagerDuty/Slack.

## DR — docs/disaster-recovery/PLAN.md
Atlas continuous backup+PITR, RPO≤5m RTO≤30m; Redis ephemeral (rebuild from DB, no backup SLA); Kafka 7d retention+replay runbook; region failover notes; dependency-outage degradations (read-through cache, queue notify, manual reconcile). Runbook+tabletop per quarter.

## Testing — docs/testing/PLAN.md
Unit (vitest/jest domain) → Integration (mongodb-memory/Docker redis/kafka testcontainers) → API Supertest + OpenAPI contract (schemathesis/dredd) → E2E (register→…→refund) Playwright → Security (authz matrix, limits, injection, webhook) → Perf k6 (load/stress/spike/soak). Coverage≥80% domain, gates in CI.

## CI/CD + Vercel + Docker — docs/deployment/PLAN.md
GH Actions: install→lint→typecheck→unit→integ→contract→scan→build→preview/prod; branch main+feature PR checks; envs dev/preview/prod; secrets in GH+Vercel; rollback via Vercel instant rollback + Atlas PITR + Kafka replay. Vercel: reuse Mongo/Redis clients (global cache), no background procs (external workers), /api timeouts noted, cron via Vercel Cron/external scheduler. Docker: local mongo/redis/kafka/mailpit + seed; prod uses managed only.

## Wireframes/Interview/ADRs
- docs/wireframes/PLAN.md: customer (home/list/detail/search/cart/wishlist/auth/OTP/profile/addr/checkout/pay/confirm/orders/track/return/review/notify) + admin (dashboard/catalog/inv/orders/pay/refund/returns/users/coupons/reviews/ship/notify/analytics/audit/settings) with IA/flows/empty/loading/error/responsive.
- docs/interview/PREP.md: why monolith/micro cutover, Mongo/Redis/Kafka/Vercel whys, bottlenecks, eventual consistency/outbox/idempotency/ordering/DLQ, JWT rotation, RBAC, indexing/tx/races, caching/pagination/CDN/async, timeouts/circuit/DR.
- docs/adr/: ADR-001..014 files (use ARCHITECTURE_DECISIONS.md as index; expand per phase template).
