# Local Development — Phase 8

## Quick Start

### Prerequisites

- Node.js 22+
- Docker + Docker Compose (for local infrastructure)
- Git

### Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd rest-mock-apis

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Start local infrastructure
npm run docker:up

# 5. Start development server
npm run dev
```

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests
npm run test

# Watch mode
npm run test:watch

# Test with coverage
npm run test:coverage
```

### Building for Production

```bash
npm run build
npm start
```

## Local Infrastructure

The Docker Compose setup provides:

| Service | Port | Purpose |
|---------|------|---------|
| MongoDB | 27017 | Primary database |
| Redis | 6379 | Cache, rate limiting, OTP |
| Kafka + Zookeeper | 9092/2181 | Event streaming |
| Mailpit | 8025/1025 | Email testing |

```bash
# Start all infrastructure
npm run docker:up

# Stop all infrastructure
npm run docker:down
```

## Configuration

Edit `.env` for local development:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/rest-mock-apis-dev
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot-reload |
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

## Development Workflow

1. **Code**: Edit source files in `src/`
2. **Test**: Run `npm run test` to verify changes
3. **Lint**: Run `npm run lint` to check code quality
4. **Build**: Run `npm run build` to verify compilation
5. **Debug**: Use Node.js debugger or IDE debugger

## IDE Setup

Recommended VS Code extensions:
- ESLint
- Prettier
- TypeScript Vue Toolkit (for TypeScript support)
- Docker

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -i :3000 | awk '{print $2}' | xargs kill -9
```

### Docker Issues
```bash
# Remove all containers and volumes
npm run docker:down
docker volume prune
npm run docker:up
```

### MongoDB Connection Issues
```bash
# Check MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker logs rest-mock-mongodb
```