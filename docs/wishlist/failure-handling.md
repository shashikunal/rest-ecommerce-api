# Wishlist — Failure Handling

| Scenario                                | Behavior                                  |
| --------------------------------------- | ----------------------------------------- |
| Add valid item                          | 201                                       |
| Duplicate add                           | 200 existing (no 409)                     |
| Unknown product                         | 404                                       |
| Concurrent duplicate adds               | Single line wins; loser gets 200 existing |
| Remove missing/foreign item             | 404                                       |
| Bad cursor                              | 400 `INVALID_CURSOR`                      |
| Referenced product archived/unpublished | Item kept, `UNAVAILABLE`                  |
| Referenced product deleted              | Item kept, `REMOVED`; list still renders  |
| Rate limit exceeded                     | 429 + `Retry-After`                       |
| Redis/Mongo down                        | Same policy as cart                       |
