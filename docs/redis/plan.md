# Redis + Rate Limiting

## Redis
Keys: `rl:{scope}:{id}:{route}` (60-900s), `otp:{purpose}:{hash}` (300-600s), `login:fail:{ip|acct}`, `cache:product:{id}` 300-900s, `cache:cat:*`, `idem:{key}` 24h, `lock:coupon:{code}` 5-10s. Eviction allkeys-lru; fail: limits fail-closed (auth/pay), cache fail-through; invalidate on write; single-flight anti-stampede; monitor hit-rate/latency/errors.

## Limits (sliding-window; token-bucket for search burst)
Global 200/m/IP; register 10/h/IP; login 5/15m per IP+acct; OTP req 4/10m/contact; OTP verify 5/OTP; reset 3/15m/acct; search 60/m/user (burst 10); cart 60/m; checkout 10/m/user; pay 5/m/user; admin 60/m; upload 10/h; webhook 100/m/provider+sig. 429 + `Retry-After` + `RateLimit-*`; abuse alerts on 429/auth-fail spikes.
