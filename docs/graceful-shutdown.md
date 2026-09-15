# Graceful Shutdown — Phase 8

## Overview

The application handles `SIGTERM` and `SIGINT` signals to perform a graceful shutdown sequence that ensures data integrity and clean resource cleanup.

## Shutdown Sequence

```
SIGTERM/SIGINT
    ↓
1. Stop accepting new connections (HTTP server.close())
    ↓
2. Allow in-flight requests to finish (configurable timeout)
    ↓
3. Stop Kafka consumers
    ↓
4. Flush/close Kafka producer
    ↓
5. Close Redis connection
    ↓
6. Close MongoDB connection
    ↓
7. Exit process (code 0)
```

## Implementation Details

### Timeout Configuration

- **Default shutdown timeout**: 30 seconds (`SERVER_SHUTDOWN_TIMEOUT`)
- If shutdown takes longer than the timeout, the process is forcefully exited
- The timeout is unreferenced to prevent blocking natural process exit

### Connection Cleanup Order

1. **HTTP Server**: Stop accepting new connections immediately
2. **Kafka**: Stop consumers first (stop processing), then flush producer
3. **Redis**: Close with `quit()` for proper cleanup
4. **MongoDB**: Close connection pool gracefully

### Error Handling During Shutdown

Errors during shutdown are logged but don't prevent the process from exiting. This ensures:
- The shutdown always completes within the timeout
- Failed cleanup doesn't hang the application
- Logs provide visibility into cleanup issues

## Why Graceful Shutdown Matters

### Data Integrity
- In-flight database writes complete before connections close
- Kafka messages are flushed before producer disconnects
- Redis operations complete before connection closes

### Resource Cleanup
- Connection pools are properly closed
- File descriptors are released
- Memory is properly freed by Node.js

### Operational Reliability
- Zero-downtime deployments work correctly
- Container orchestration handles shutdown signals properly
- Load balancers can drain connections before shutdown

### Serverless Compatibility
- Vercel sends SIGTERM before cold starts
- Proper cleanup prevents resource leaks
- Connection reuse works across invocations

## Signal Handling

```typescript
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### Process Error Handlers

- `uncaughtException`: Logs and exits (prevents undefined behavior)
- `unhandledRejection`: Logs and exits (prevents silent failures)

## Testing Graceful Shutdown

The shutdown sequence is tested by:
1. Sending SIGTERM to the process
2. Verifying all connections are closed
3. Confirming process exits with code 0
4. Checking that no errors are thrown during cleanup

## Future Enhancements

- Add health check status during shutdown
- Support for drain mode (no new requests but existing continue)
- Integration with process managers (PM2, Docker)
- Metrics emission on shutdown