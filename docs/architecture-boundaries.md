# Architecture Boundaries — Phase 8

## Overview

This document defines the strict architectural boundaries that must be enforced throughout the project lifecycle. Violations of these boundaries lead to tightly coupled code that is difficult to test, maintain, and scale.

## Layered Architecture

```
HTTP Layer          → app.ts, routes, middleware
Application Layer   → module app-services
Domain Layer        → module domain logic
Ports/Interfaces    → repository interfaces
Infrastructure      → database, redis, kafka adapters
```

### Layer Responsibilities

| Layer | Can Depend On | Cannot Depend On |
|-------|--------------|-----------------|
| HTTP | Application, Shared | Domain, Infrastructure |
| Application | Domain, Ports | HTTP, Infrastructure |
| Domain | Ports (interfaces) | HTTP, MongoDB, Redis, Kafka, Express |
| Ports | Domain | Everything concrete |
| Infrastructure | Domain, Ports | HTTP, Express |

## Rule: What Cannot Happen

### Domain Layer Restrictions

```
Domain code must NOT directly depend on:
  ❌ Express
  ❌ MongoDB / Mongoose
  ❌ Redis
  ❌ Kafka
  ❌ Nodemailer
  ❌ Any HTTP framework
```

Domain code should only depend on:
- Other domain entities
- Repository interfaces (ports)
- Value objects
- Domain events
- Domain services

### Controller Restrictions

```
Controllers must NOT:
  ❌ Query MongoDB directly
  ❌ Call Redis directly
  ❌ Publish Kafka events directly
  ❌ Contain business rules
  ❌ Access process.env directly
  ❌ Create database connections
```

Controllers should only:
- Parse and validate HTTP request data
- Call application service methods
- Format and send HTTP responses
- Handle HTTP-specific concerns (status codes, headers)

### Application Service Restrictions

```
Application services must NOT:
  ❌ Be HTTP-specific (no req/res objects)
  ❌ Contain business rules
  ❌ Directly access infrastructure
```

## Dependency Injection

The foundation uses a lightweight dependency composition approach:

```typescript
// Dependencies are explicit and injectable
const app = createApp({
  config: getEnv(),
  logger: createLogger(getEnv()),
  rateLimiter: createRateLimiter(logger, config),
});
```

This enables:
- **Testing**: Replace dependencies with mocks/stubs
- **Flexibility**: Swap implementations without changing logic
- **Clarity**: All dependencies are visible at the composition root

### Replaceable Dependencies

- **Repositories**: Mock database access
- **Redis**: Mock for rate limiter tests
- **Kafka**: Mock for event producer tests
- **External services**: Mock email, SMS, payment gateways
- **Clock/Time**: Mock for expiration testing
- **Configuration**: Mock for different environments

## Architectural Boundary Tests

Where practical, automated checks detect forbidden dependencies:

```
domain → Express    ❌  (should fail)
domain → MongoDB    ❌  (should fail)
domain → Redis      ❌  (should fail)
domain → Kafka      ❌  (should fail)

controller → MongoDB ❌  (should fail)
controller → Redis   ❌  (should fail)
controller → Kafka   ❌  (should fail)

application → HTTP-specific ❌  (should fail)
```

## Module Boundaries

Each module follows the pattern:
```
Route → Middleware → Controller → AppService → Domain → Repo → Mongo
```

### Allowed Cross-Module Access

- Service → its own domain + repository
- Cross-domain via service interface or events (preferred for notifications, analytics, audit)
- Checkout/order/pay/inventory in shared transaction where atomicity required

### Forbidden Cross-Module Access

- Controller → another module's repository
- Domain → another module's domain
- Any bypass of the service layer
- Shared mutable in-memory state
- Circular dependencies

## Clean/Hexagonal Architecture Benefits

1. **Testability**: Domain logic tested without infrastructure
2. **Maintainability**: Changes in infrastructure don't affect domain
3. **Portability**: Easy to swap database, cache, or message broker
4. **Scalability**: Clear extraction path to microservices
5. **Team Parallelism**: Modules can be developed independently

## Extraction Path

When scale demands it, modules can be extracted to services:
1. Move the module's domain + application service to a new service
2. Implement the repository interface as a gRPC/HTTP client
3. Keep the same domain logic, change only the infrastructure
4. Events continue to work via Kafka topics

This is possible because the architecture already separates concerns and defines clear interfaces.