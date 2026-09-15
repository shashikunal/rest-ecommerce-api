# Phase 8 — Interview Preparation

## Why Modular Monolith Instead of Microservices?

1. **Low Ops Cost**: Single deploy, no Kubernetes, no service mesh
2. **ACID Transactions**: MongoDB transactions work across domains within the monolith
3. **Clear Extraction Path**: Module boundaries (route→service→domain→repo) allow later extraction to microservices when scale demands it
4. **Team Velocity**: Small team can ship faster with a monolith

**At 10x traffic**: Vertical scaling + MongoDB read replicas
**At 100x traffic**: Extract search/notify modules to services, add Redis cache layer
**At 1000x traffic**: Full microservice extraction with Kafka as the integration backbone

## Why Clean/Hexagonal Architecture?

- **Testability**: Domain logic tested without infrastructure
- **Separation of Concerns**: Each layer has a single responsibility
- **Dependency Inversion**: Domain depends on abstractions (interfaces), not concretions
- **Portability**: Swap database, cache, or message broker without changing domain logic

## Why Separate app.ts and server.ts?

- **Testability**: Import `createApp()` without starting a network listener
- **Separation of Concerns**: `app.ts` builds the Express application, `server.ts` handles the HTTP lifecycle
- **Serverless Compatibility**: `app.ts` can be exported as a handler for Vercel

## Why Centralized Configuration?

- **Fail Fast**: All config validated at startup, not discovered at runtime
- **Type Safety**: Zod schemas provide typed access to all configuration
- **No Scattered `process.env`**: All configuration accessed via `getEnv()`
- **Security**: No secrets in source code, all in `.env` files (gitignored)

## Why Redis Instead of In-Memory State?

- **Vercel Compatibility**: Serverless functions are stateless; in-memory state is lost between invocations
- **Distributed Coordination**: Rate limiting, OTP, idempotency require shared state
- **Scalability**: Multiple instances can share the same Redis state

## Why Kafka Consumers Cannot Live in Vercel Functions?

- **Serverless Constraints**: Vercel functions have short timeouts, no long-running processes
- **No Background Workers**: Vercel doesn't support persistent background processes
- **Cold Starts**: Kafka consumers would be killed during cold starts, breaking message processing
- **Solution**: Kafka workers run on external infrastructure (Railway, Render, Fly, EC2)

## Why At-Least-Once + Idempotency Instead of Exactly-Once?

- **Practical**: Exactly-once is theoretically impossible in distributed systems
- **Idempotency is Achievable**: Consumers can deduplicate using idempotency keys
- **Proven Pattern**: At-least-once delivery + idempotent consumers is the industry standard
- **Trade-off**: Some duplicate processing on failure, but handled gracefully

## Why Correlation IDs?

- **Distributed Tracing**: Trace requests across service boundaries
- **Debugging**: Support teams can correlate logs across systems
- **Audit Trail**: Every operation linked to a specific request
- **Support**: Customers can provide correlation IDs for troubleshooting

## Why Centralized Error Handling?

- **Consistent API Contract**: All errors follow the same format (`{code, message, details, correlationId}`)
- **Security**: Stack traces, database errors, and internals never leak to clients
- **Maintainability**: Error handling logic in one place, not scattered across controllers
- **Mapping**: Internal errors mapped to stable public error codes

## Why Zod at the API Boundary?

- **Type Safety**: Zod schemas infer TypeScript types automatically
- **Validation**: All input validated before reaching business logic
- **Documentation**: Zod schemas can generate OpenAPI documentation
- **Anti-NoSQLi**: Zod validates against allowlists, preventing injection

## Why Readiness and Liveness Are Different?

- **Liveness**: Is the process alive? (Don't restart a healthy process that's temporarily waiting for a dependency)
- **Readiness**: Can this instance handle traffic? (Don't route traffic to an instance that can't serve requests)
- **Different Failure Modes**: A database outage affects readiness but not liveness

## Why Graceful Shutdown Matters?

- **Data Integrity**: In-flight database writes complete before connections close
- **Clean Connections**: No resource leaks
- **Zero-Downtime Deployments**: Load balancer drains connections before shutdown
- **Professional Operation**: The system shuts down cleanly, not abruptly

## Why Connection Reuse Matters in Serverless?

- **Cold Starts**: Each cold start is expensive; reusing connections avoids re-establishing them
- **Resource Efficiency**: Multiple invocations share the same connection pool
- **Vercel Constraints**: Vercel may reuse instances; connections should persist across invocations
- **Global Variables**: MongoDB, Redis, and Kafka clients stored as global variables

## Why Infrastructure Must Not Leak Into Domain Logic?

- **Testability**: Domain logic tested with mock repositories
- **Portability**: Domain logic works with any database, cache, or message broker
- **Maintainability**: Infrastructure changes don't affect business logic
- **Extraction Path**: Clear path to extracting modules to microservices

## How Would This Architecture Evolve?

### At 10x Traffic
- MongoDB Atlas M30→M40 scale-up
- Redis: Add read replicas
- Vercel: More compute, edge functions
- Add Redis cache layer for frequently read data

### At 100x Traffic
- Extract search module to dedicated service (Atlas Search → OpenSearch)
- Extract notification module to worker service
- Add CDN for media
- MongoDB sharding
- Add read replicas for MongoDB

### At 1000x Traffic
- Full microservice extraction
- Kafka partitioning for high throughput
- Multi-region deployment
- Event sourcing for audit
- CQRS for read/write separation
- Auto-scaling groups for workers

## Security Concepts Demonstrated

1. **Defense in Depth**: Multiple layers of security (Helmet, CORS, Zod, rate limiting, JWT)
2. **Fail-Safe Defaults**: Rate limiter fails open (not fail-closed) for non-critical endpoints
3. **Principle of Least Privilege**: Each module only accesses its own data
4. **Never Trust Client Input**: All input validated with Zod
5. **Sensitive Data Protection**: Redaction in logs, no secrets in error responses
6. **Separation of Concerns**: Security controls in middleware, not business logic

## Observability Concepts Demonstrated

1. **Structured Logging**: JSON logs with correlation IDs for tracing
2. **Metrics Collection**: Request rates, latency, error rates
3. **Health Checks**: Liveness and readiness probes for operational visibility
4. **Correlation ID Propagation**: Every log includes the correlation ID for traceability
5. **Graceful Degradation**: Rate limiter fails open when Redis is unavailable

## Testing Concepts Demonstrated

1. **Unit Tests**: Error architecture, validation, utilities, correlation ID
2. **Deterministic Tests**: No external dependencies, all tests self-contained
3. **Test Foundation**: Ready for integration tests with Supertest, MongoDB, Redis

## Common Interview Questions

1. **Q**: Why not use Supabase/PostgreSQL?
   **A**: MongoDB provides flexible schema for product variants/attributes, Atlas search, and document-oriented data model that fits e-commerce catalogs.

2. **Q**: Why not microservices from day 1?
   **A**: Premature microservices add ops complexity without benefit. Modular monolith allows extraction later when scale justifies it.

3. **Q**: How does idempotency work?
   **A**: Idempotency keys (UUID v4) are stored in Redis (24h TTL) and MongoDB (for money operations). Same key+same hash replays stored response. Same key+different body returns 409.

4. **Q**: How does the outbox pattern work?
   **A**: Business data and outbox event written in a single MongoDB transaction. Publisher sweeps PENDING events to Kafka. Consumer processes and marks as SENT.

5. **Q**: What happens when MongoDB is down?
   **A**: Application fails fast on startup (startup-critical dependency). Readiness probe returns 503. Rate limiter fails open for non-critical endpoints.

6. **Q**: How does graceful shutdown work?
   **A**: SIGTERM/SIGINT triggers: stop HTTP server → allow in-flight requests → stop Kafka consumers → flush producer → close Redis → close MongoDB → exit. 30s timeout with forced exit.
