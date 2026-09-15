# REST Mock APIs — Production-Grade E-Commerce Platform

> **Modular Monolith** · **Vercel-first** · **Interview-Ready**

## Overview

Production-grade e-commerce platform built as a modular monolith with strict Clean/Hexagonal Architecture. Built for Vercel deployment with MongoDB Atlas, Redis, and Apache Kafka.

## Architecture

- **Pattern**: Modular Monolith with Clean/Hexagonal Architecture
- **Runtime**: Node.js 22 + TypeScript + Express
- **Database**: MongoDB Atlas (primary), Redis (ephemeral), Kafka (async events)
- **Deployment**: Vercel-first, serverless-compatible
- **API**: REST + JSON, base `/api/v1`, OpenAPI 3.1

## Quick Start

```bash
# Install dependencies
npm install

# Start local infrastructure (MongoDB, Redis, Kafka, Mailpit)
npm run docker:up

# Start development server
npm run dev

# Run tests
npm run test:unit
npm run test:integration

# Build for production
npm run build
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot-reload (tsx) |
| `npm run build` | TypeScript compilation |
| `npm run start` | Start production server |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier formatting |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run all tests |
| `npm run test:unit` | Run unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run docker:up` | Start Docker infrastructure |
| `npm run docker:down` | Stop Docker infrastructure |

## Project Structure

```
src/
├── app/                  # Application layer (Express app, routes)
├── config/               # Configuration (env, database, redis, kafka, logger)
├── modules/              # Domain modules (auth, products, cart, orders, etc.)
├── infrastructure/       # Infrastructure adapters (database, redis, kafka, observability)
├── shared/               # Shared kernel (errors, http, types, utils, constants, security)
├── docs/                 # OpenAPI spec generation
└── server.ts             # Application bootstrap and server startup
```

## Environment Configuration

Copy `.env.example` to `.env` and fill in values. All configuration is validated via Zod at startup.

Required variables: `MONGODB_URI`, `REDIS_URL`, `KAFKA_BROKERS`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.

## Health Endpoints

- `GET /health` — Application status
- `GET /health/live` — Process liveness (no dependency checks)
- `GET /health/ready` — Traffic readiness (checks MongoDB, Redis)

## API Documentation

OpenAPI 3.1 spec available at `/api/docs` (development) or `/openapi.json`.

## Security

- Helmet security headers (CSP, HSTS, XSS protection)
- Restricted CORS (origin-allowlisted)
- Body size limits (100kb)
- Correlation ID validation (UUID v4)
- Sensitive header redaction in logs
- Structured error responses without stack traces
- Rate limiting foundation (Redis-backed)

## License

MIT
# rest-ecommerce-api
