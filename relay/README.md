# Graceful Books Sync Relay Server

A zero-knowledge sync relay built on Cloudflare Workers + Hono for multi-device synchronization.

## Overview

The Graceful Books Sync Relay enables users to sync their encrypted financial data across multiple devices while maintaining complete data privacy. The server **never has access to plaintext data** - all payloads are encrypted client-side before transmission.

### Key Features

- **Zero-Knowledge Architecture**: Server stores only encrypted payloads
- **Geographic Distribution**: Multiple regions (US, EU, AP) for low latency
- **99.9% Uptime SLA**: Production-grade reliability with health monitoring
- **Real-time Sync**: WebSocket notifications for instant updates
- **Automatic Failover**: Client automatically switches regions on failure
- **Rate Limiting**: Protection against abuse
- **Comprehensive Monitoring**: SLA tracking and analytics

## Deployment Options

### Hosted (Cloud)
- **Runtime**: Cloudflare Workers (edge computing)
- **Framework**: Hono (edge-native web framework)
- **Database**: Cloudflare D1 / Turso (SQLite-compatible)
- **WebSockets**: Durable Objects for connection management
- **Analytics**: Cloudflare Analytics Engine for SLA tracking

### Self-Hosted
- **Runtime**: Node.js 18+ (or Docker)
- **Framework**: Hono (same codebase)
- **Database**: SQLite (local file)
- **WebSockets**: Built-in WebSocket support
- **Platforms**: Linux, Windows, macOS, Docker

**See:** [Self-Hosted Setup Guide](./docs/SELF_HOSTED_SETUP.md)

## Architecture

```
┌──────────────┐     HTTPS + WSS      ┌─────────────────┐
│              │ ───────────────────> │                 │
│  Client      │                      │  Sync Relay     │
│  (Encrypted) │ <─────────────────── │  (Cloudflare)   │
└──────────────┘    Encrypted Data    └─────────────────┘
                                              │
                                              ▼
                                      ┌───────────────┐
                                      │   D1/Turso    │
                                      │   (Encrypted) │
                                      └───────────────┘
```

### Zero-Knowledge Guarantee

1. Client encrypts all data using AES-256 before sending
2. Server receives encrypted blob (Base64)
3. Server stores blob without attempting decryption
4. Other devices pull encrypted blob
5. Devices decrypt locally with their encryption key

**The server NEVER has access to encryption keys or plaintext data.**

## Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI: `npm install -g wrangler`

## Setup

### 1. Install Dependencies

```bash
cd relay
npm install
```

### 2. Configure Cloudflare

Create a Cloudflare D1 database:

```bash
wrangler d1 create graceful-books-sync
```

Copy the database ID and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "graceful-books-sync"
database_id = "YOUR_DATABASE_ID_HERE"
```

Create KV namespace for rate limiting:

```bash
wrangler kv:namespace create "RATE_LIMIT"
wrangler kv:namespace create "RATE_LIMIT" --preview
```

Update `wrangler.toml` with KV IDs.

### 3. Set Environment Variables

Copy `.dev.vars.example` to `.dev.vars` and configure:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
MAX_REQUESTS_PER_MINUTE=60
MAX_PAYLOAD_SIZE_MB=10
```

### 4. Initialize Database

The database schema is automatically initialized on first request. You can also manually run migrations:

```bash
wrangler d1 execute graceful-books-sync --file=./migrations/001_initial_schema.sql
```

## Development

### Run Local Dev Server

```bash
npm run dev
```

The server will be available at `http://localhost:8787`

### Test Endpoints

Health check:
```bash
curl http://localhost:8787/health
```

Version info:
```bash
curl http://localhost:8787/version
```

### Run Tests

```bash
npm test
```

With coverage:
```bash
npm run test:coverage
```

## Deployment

### Deploy to Staging

```bash
npm run deploy:staging
```

### Deploy to Production

```bash
npm run deploy:production
```

### Verify Deployment

```bash
curl https://sync.gracefulbooks.com/health
```

## API Endpoints

### POST `/sync/push`

Push encrypted changes to relay.

**Request:**
```json
{
  "protocol_version": "1.0.0",
  "device_id": "device-123",
  "timestamp": 1234567890,
  "changes": [
    {
      "id": "change-1",
      "entity_type": "transaction",
      "entity_id": "txn-456",
      "operation": "CREATE",
      "encrypted_payload": "BASE64_ENCRYPTED_DATA",
      "version_vector": { "device-123": 1 },
      "timestamp": 1234567890
    }
  ]
}
```

**Response:**
```json
{
  "protocol_version": "1.0.0",
  "success": true,
  "accepted": ["change-1"],
  "rejected": [],
  "timestamp": 1234567890
}
```

### POST `/sync/pull`

Pull encrypted changes from relay.

**Request:**
```json
{
  "protocol_version": "1.0.0",
  "device_id": "device-123",
  "since_timestamp": 1234567000,
  "sync_vector": { "device-123": 5 }
}
```

**Response:**
```json
{
  "protocol_version": "1.0.0",
  "changes": [
    {
      "id": "change-2",
      "entity_type": "transaction",
      "entity_id": "txn-789",
      "operation": "UPDATE",
      "encrypted_payload": "BASE64_ENCRYPTED_DATA",
      "version_vector": { "device-456": 1 },
      "timestamp": 1234567800,
      "device_id": "device-456"
    }
  ],
  "has_more": false,
  "timestamp": 1234567890
}
```

### GET `/health`

Check server health.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "region": "us",
  "version": "1.0.0",
  "database": {
    "status": "ok",
    "latency_ms": 10.5
  },
  "uptime_seconds": 3600
}
```

### GET `/regions`

Get available sync regions.

**Response:**
```json
{
  "regions": [
    {
      "id": "us",
      "name": "United States",
      "location": "North America",
      "endpoint": "https://sync-us.gracefulbooks.com",
      "status": "online",
      "latency_ms": 50
    }
  ],
  "timestamp": 1234567890
}
```

### GET `/metrics/sla`

Get SLA metrics (last 24 hours).

**Response:**
```json
{
  "uptime_percentage": 99.95,
  "total_requests": 10000,
  "successful_requests": 9995,
  "failed_requests": 5,
  "avg_response_time_ms": 45.2,
  "period_start": 1234480890,
  "period_end": 1234567890
}
```

## WebSocket API

### Connect

```javascript
const ws = new WebSocket('wss://sync.gracefulbooks.com/ws?device_id=device-123');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'sync_available') {
    // Trigger sync pull
    syncClient.pull();
  }
};
```

### Message Types

- `ping`: Server keepalive (client should respond with `pong`)
- `pong`: Client keepalive response
- `sync_available`: New changes available for this user
- `subscribe`: Connection confirmation

## Monitoring

### SLA Dashboard

View metrics at: `https://sync.gracefulbooks.com/metrics/sla`

Target SLA: **99.9% uptime**

### Health Checks

Each region has a health endpoint:
- US: `https://sync-us.gracefulbooks.com/health`
- EU: `https://sync-eu.gracefulbooks.com/health`
- AP: `https://sync-ap.gracefulbooks.com/health`

### Cloudflare Analytics

View real-time analytics in Cloudflare dashboard:
- Request volume
- Error rates
- Response times
- Geographic distribution

## Security

### Encryption

- All payloads encrypted client-side with AES-256
- Server never sees plaintext data
- Zero-knowledge architecture enforced

### Rate Limiting

- 60 requests per minute per IP (configurable)
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

### HTTPS Only

- All endpoints require HTTPS
- TLS 1.3 minimum
- HSTS headers enabled

### Request Validation

- Protocol version validation
- Request size limits (10MB default)
- Input sanitization

## Troubleshooting

### High Latency

1. Check region selection (use nearest region)
2. Verify Cloudflare routing
3. Check database performance
4. Review Analytics for bottlenecks

### Connection Failures

1. Verify DNS resolution
2. Check Cloudflare status page
3. Test failover to alternate region
4. Review error logs in Cloudflare dashboard

### Sync Not Working

1. Check health endpoint
2. Verify protocol version match
3. Review rate limit headers
4. Check client-side encryption
5. Verify device_id is set

## Development

### Project Structure

```
relay/
├── src/
│   ├── index.ts          # Main worker entry point
│   ├── types.ts          # TypeScript definitions
│   ├── database.ts       # Database operations
│   ├── routes.ts         # API route handlers
│   ├── middleware.ts     # Middleware (rate limiting, etc)
│   ├── websocket.ts      # WebSocket Durable Objects
│   └── __tests__/        # Test suite
├── wrangler.toml         # Cloudflare configuration
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── README.md            # This file
```

### Adding New Endpoints

1. Define types in `src/types.ts`
2. Add route handler in `src/routes.ts`
3. Add tests in `src/__tests__/`
4. Update this README
5. Deploy to staging for testing

### Database Migrations

Create migration file in `migrations/`:

```sql
-- migrations/002_add_feature.sql
ALTER TABLE sync_changes ADD COLUMN new_field TEXT;
```

Apply:
```bash
wrangler d1 execute graceful-books-sync --file=./migrations/002_add_feature.sql
```

## Self-Hosted Documentation

**Full control. Your data on your servers. We'll show you how.**

Comprehensive guides for running your own sync relay:

- **[Setup Guide](./docs/SELF_HOSTED_SETUP.md)** - Get started in 5 minutes
- **[Environment Variables](./docs/ENVIRONMENT_VARIABLES.md)** - Complete configuration reference
- **[Health Checks](./docs/HEALTH_CHECKS.md)** - Monitoring and alerting
- **[Migration Guide](./docs/MIGRATION_GUIDE.md)** - Move from hosted to self-hosted
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Security Checklist](./docs/SECURITY_CHECKLIST.md)** - Secure your deployment
- **[Version Compatibility](./docs/VERSION_COMPATIBILITY.md)** - Client/server compatibility

### Quick Start (Docker)

```bash
# 1. Download docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/gracefulbooks/graceful-books/main/relay/docker-compose.yml

# 2. Start relay
docker-compose up -d

# 3. Verify
curl http://localhost:8787/health
```

**That's it!** Your relay is running.

See [Self-Hosted Setup Guide](./docs/SELF_HOSTED_SETUP.md) for detailed instructions.

## Support

- GitHub Issues: https://github.com/gracefulbooks/graceful-books/issues
- Documentation: https://docs.gracefulbooks.com
- Self-Hosted Guide: https://docs.gracefulbooks.com/self-hosted
- Status Page: https://status.gracefulbooks.com

## License

Proprietary - Graceful Books, Inc.
