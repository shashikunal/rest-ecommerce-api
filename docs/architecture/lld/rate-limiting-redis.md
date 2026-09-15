# Rate Limiting + Redis LLD (exact keys, no code)

Limiter shape: `{identifier, key, algo, limit, window, ttl, onDeny(429+Retry-After), redisDown}`. Sliding-window (ZADD+EXPIRE) default; token-bucket (list+refill) for search burst.
- global `rl:g:{ip}` 200/m; register `rl:reg:{ip}` 10/h; login `rl:login:{ip}:{acctH}` 5/15m; otp-req `rl:otp:{contactH}` 4/10m; otp-verify `otp:att:{id}` 5/OTP-life; reset `rl:rst:{acctH}` 3/15m; search `rl:search:{uid|ip}` 60/m burst10; cart `rl:cart:{uid}` 60/m; checkout `rl:co:{uid}` 10/m; payment `rl:pay:{uid}` 5/m; admin `rl:adm:{uid}` 60/m; upload `rl:up:{uid}` 10/h; webhook `rl:wh:{provider}` 100/m + HMAC gate first.
Redis down: fail-closed (deny+503+alert) on login/otp/checkout/payment/webhook; fail-open+alert on reads/search. Never in-memory counters.
Namespaces: `rate:* otp:* cache:{domain}:{resource}:{id} (5–15m, write-invalidate, single-flight, 60s neg-cache; never PII/secrets/money) idem:{scope}:{key} (24h) lock:coupon:{code} (5–10s, only if contention proven)`. Structures: counters ZSET/INCR, OTP HASH, cache STRING-JSON, idem HASH{reqHash,resp,status}. Owner per module; invalidation by writer; allkeys-lru; hit-rate/latency monitored.
