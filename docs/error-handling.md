# Error Handling — Phase 8

## Error Contract

All API errors follow a standardized format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": [],
    "correlationId": "uuid"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `VALIDATION_ERROR` | 400 | Zod validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `UNPROCESSABLE` | 422 | Semantic error |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `INTERNAL` | 500 | Unexpected internal error |
| `DB_ERROR` | 503 | Database failure |
| `REDIS_ERROR` | 503 | Redis failure |
| `KAFKA_ERROR` | 503 | Kafka failure |
| `EXTERNAL_SERVICE_ERROR` | 502 | External service failure |

## Error Classes

The foundation provides a typed error hierarchy:

```
Error
└── AppError (base)
    ├── ValidationError (400)
    ├── AuthenticationError (401)
    ├── AuthorizationError (403)
    ├── NotFoundError (404)
    ├── ConflictError (409)
    ├── RateLimitError (429)
    ├── ExternalServiceError (502)
    ├── DatabaseError (503)
    └── InfrastructureError (500)
```

## Security

- **Never expose stack traces** in production responses
- **Never expose database errors** to clients
- **Never expose internal infrastructure details**
- **Never expose secrets or sensitive data**
- **Never expose service names** in error messages
- **Never log** passwords, tokens, OTPs, or payment data

## Global Error Handler

The Express global error handler catches all errors:

```typescript
app.use((err: Error, req, res, next) => {
  if (err instanceof AppError) {
    // Known error — return with status code and details
    res.status(err.statusCode).json(formatErrorResponse(err));
  } else {
    // Unexpected error — mask internals
    res.status(500).json(formatUnexpectedError(err));
  }
});
```

## Error Logging

All errors are logged with structured metadata:

```json
{
  "timestamp": "2024-01-15T10:00:00.000Z",
  "level": "error",
  "message": "Application error",
  "service": "rest-mock-apis",
  "environment": "development",
  "correlationId": "abc-123",
  "errorName": "NotFoundError",
  "errorCode": "NOT_FOUND",
  "details": []
}
```

## Async Error Handling

The `asyncHandler` utility wraps async Express handlers:

```typescript
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  if (!user) throw AppErrorFactory.notFound('User', req.params.id);
  res.json(user);
}));
```

This prevents unhandled promise rejections from escaping silently.