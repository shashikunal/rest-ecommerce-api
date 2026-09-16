# Cart — Security

- Ownership: `userId` derived exclusively from `req.user` (JWT + session check);
  `userId/ownerId` in bodies rejected by strict zod schemas (mass-assignment safe).
- BOLA/IDOR: all queries filter `{userId}`; foreign `itemId` → 404 (no existence
  oracle across users); `cartId` guessing impossible (cart addressed as `/cart`).
- Injection: SKU trimmed/upper-cased, length-capped; `itemId` UUID-validated;
  Mongoose parameterized operators (no `$where`/raw query building).
- Abuse: per-user 60/min rate limit on `/api/v1/cart*` (+ global IP limit);
  quantity capped (1–50), lines capped (50), JSON body limits enforced.
- Untrusted fields (`price/currency/title/total/userId/version/status`) never
  accepted — catalog is authoritative; `expectedVersion` is the only client
  concurrency input and only moves forward on match.
- Error contract: 400/401/404/409/422/429; no stack traces or DB internals.
