# Cart — Testing

- Unit (`tests/unit/cart/cart-domain.test.ts`): quantity validation (int/NaN/
  Infinity/decimals), SKU identity normalization, integer-minor subtotal,
  duplicate merge, unavailable rejection, stale-price flagging, version conflict.
- API (`tests/integration/cart-wishlist.test.ts`): full lifecycle
  (empty→add→merge→stale-409→update→remove→clear), price-injection rejection,
  quantity bounds, unavailable SKU 422, BOLA isolation (user-b sees empty cart,
  gets 404 on user-a lines).
- Concurrency: version-conflict path covered at service + API level; atomic
  merge/conditional-push in `MongoCartRepository` (single-doc ops, no locks).
- Regression: full suite 193/193 green; `tsc` clean for new files; eslint clean
  for new files (2 remaining repo-wide errors are pre-existing in untouched
  catalog files).

## State matrix

| Scenario                | Expected                 | Covered                   |
| ----------------------- | ------------------------ | ------------------------- |
| Add valid item          | added                    | API                       |
| Add duplicate           | merged                   | unit + API                |
| Invalid product/variant | 422                      | unit + API                |
| Bad quantity            | 400                      | API                       |
| Qty overflow            | 422                      | service                   |
| Remove / clear          | emptied, identity kept   | API                       |
| Concurrent update       | 409                      | unit + API                |
| Retry (idempotency)     | replay / 409 on mismatch | middleware (Redis-backed) |
| Foreign cart access     | 404/empty                | API                       |
| Rate limit              | 429                      | shared limiter + policy   |
