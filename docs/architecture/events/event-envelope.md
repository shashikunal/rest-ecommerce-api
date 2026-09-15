# Envelope + Identity + Key Contracts

Canonical envelope (ALL producers, validated at edge of producer + consumer):
`{eventId uuid-v4 unique, eventType 'order.created', eventVersion 1, occurredAt ISO, producer 'checkout-svc', aggregateType 'order', aggregateId, correlationId (req flow, inherit x-correlation-id), causationId (parent eventId|requestId or null), schemaVersion (=eventVersion), payload {...}}`.
Field rules: eventId generated once at business-tx time (stored in outbox; republication reuses it); correlationId propagated end-to-end (HTTP→tx→outbox→Kafka headers→consumers→downstream events as causationId chain); aggregateId = partition key source (orderId/skuId/productId/userId); payload = ids + minimal business data + versions (never full docs, media bytes, secrets: no passwords/OTPs/tokens/cards; PII minimal — userId + email only where mail needs it).
Example `order.created.v1` payload: `{orderId, orderNo, userId, totals{...}, itemCount, idemKey, orderVersion}`. Required vs optional per contract table in catalog; consumers ignore unknown fields (forward-compat); breaking change → `eventVersion+1` dual-publish window, never silent resemantic.
