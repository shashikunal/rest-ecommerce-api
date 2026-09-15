# Health Checks — Phase 8

## Endpoints

### GET /health

**Purpose**: Application status check
**Dependencies**: None
**Use Case**: Load balancer, monitoring

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "service": "http://localhost:3000",
  "environment": "development"
}
```

### GET /health/live

**Purpose**: Process liveness check
**Dependencies**: None
**Use Case**: Kubernetes/container orchestration
**Answer**: Is the process alive?

> Should **not** fail because MongoDB or Redis is temporarily unavailable.

Response:
```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### GET /health/ready

**Purpose**: Traffic readiness check
**Dependencies**: MongoDB, Redis
**Use Case**: Kubernetes readiness probe, traffic routing
**Answer**: Can this instance safely receive traffic?

Response (ready):
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "checks": {
    "database": "ready",
    "redis": "ready"
  }
}
```

Response (not ready):
```json
{
  "status": "not_ready",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "checks": {
    "database": "not_ready",
    "redis": "not_ready"
  }
}
```

Status code: `200` when ready, `503` when not ready.

## Security

- **No sensitive information** exposed in health check responses
- **No connection strings**, credentials, or internal details
- **No database credentials** or configuration details

## Design Decisions

### Liveness vs Readiness

**Liveness** (`/health/live`) answers: "Is the process alive?"
- Should not fail due to dependency outages
- Allows orchestration to restart a hung process
- Fast and lightweight

**Readiness** (`/health/ready`) answers: "Can this instance handle traffic?"
- Checks critical dependencies (MongoDB, Redis)
- Prevents routing traffic to instances that cannot serve requests
- Returns 503 during dependency outages

### Why Not Check Everything?

Only startup-critical dependencies are checked:
- **MongoDB**: Required for most operations
- **Redis**: Required for rate limiting, caching
- **Kafka**: Not checked (non-critical, graceful degradation)

This ensures that temporary Kafka outages don't prevent the application from receiving traffic.

## Future Enhancements

- Add Redis health check details
- Add Kafka connection status
- Add custom health check endpoints per module
- Add latency metrics to health responses