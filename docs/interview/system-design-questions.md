# Interview: System-Design Questions

1. Checkout design → tests distributed-tx thinking; key: sync tx + async events; mistake: trusting client price.
2. No oversell → cond-inc + reserve TTL; mistake: read-then-write without atomicity.
3. Distributed limits → Redis sliding-window + keys; mistake: in-memory counters on serverless.
4. OTP auth → hash+purpose+limits; mistake: plaintext/reusable OTP.
5. Order+Kafka → outbox/inbox/DLQ; mistake: dual-write without outbox.
6. Mongo event guarantee → tx biz+outbox + publisher; mistake: publish-then-commit.
7. Dup webhooks → HMAC+idem+server-fetch; mistake: trusting payload.
8. Catalog scale → indexes+cursor+CDN; mistake: offset deep pages.
9. Cache → aside+invalidate+single-flight; mistake: caching money states.
10. Notifications → prefs/dedupe/DLQ; mistake: sync mail in request path.
11. 100x → partition/shard/search-extract; mistake: premature microservices.
12. Kafka/Redis/Mongo failure → lag/replay, rebuild, PITR; mistake: blind retries.
