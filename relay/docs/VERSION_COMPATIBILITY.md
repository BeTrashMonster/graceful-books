# Version Compatibility Matrix

This document describes version compatibility between Graceful Books clients and self-hosted sync relay servers.

## Quick Reference

| Relay Version | Min Client Version | Protocol Version | Status |
|--------------|-------------------|------------------|---------|
| 1.0.0 | 1.0.0 | 1.0.0 | Current |
| 0.9.0 (beta) | 0.9.0 | 0.9.0 | Deprecated |

## Current Version

### Relay v1.0.0

**Release Date:** 2024-01-15

**Protocol Version:** 1.0.0

**Compatible Clients:**
- Desktop: v1.0.0+
- Web: v1.0.0+
- Mobile (iOS): v1.0.0+
- Mobile (Android): v1.0.0+

**Features:**
- Zero-knowledge encryption
- Multi-device sync
- WebSocket notifications
- Rate limiting
- SLA monitoring
- Health checks

**Breaking Changes:**
- None (initial release)

**Migration Notes:**
- Direct upgrade from beta 0.9.0 supported
- No data migration required

## Version Compatibility Rules

### Protocol Version

The sync protocol version follows semantic versioning:

- **Major version change** (e.g., 1.0.0 → 2.0.0): Breaking changes, clients must update
- **Minor version change** (e.g., 1.0.0 → 1.1.0): New features, backward compatible
- **Patch version change** (e.g., 1.0.0 → 1.0.1): Bug fixes, fully compatible

### Client-Server Compatibility

**Rule 1: Major versions must match**
```
Client 1.x.x ✅ Server 1.x.x
Client 2.x.x ❌ Server 1.x.x
Client 1.x.x ❌ Server 2.x.x
```

**Rule 2: Minor versions are backward compatible**
```
Client 1.0.x ✅ Server 1.1.x (client can use new server)
Client 1.1.x ✅ Server 1.0.x (server may lack new features)
Client 1.0.x ✅ Server 1.0.x (exact match)
```

**Rule 3: Patch versions are interchangeable**
```
Client 1.0.0 ✅ Server 1.0.1
Client 1.0.1 ✅ Server 1.0.0
Client 1.0.1 ✅ Server 1.0.1
```

### Checking Versions

**Client Version:**

In Graceful Books app:
1. Settings > About
2. Version shown (e.g., "v1.0.0")

**Server Version:**

```bash
curl https://your-relay.example.com/version
```

Response:
```json
{
  "version": "1.0.0",
  "protocol_version": "1.0.0",
  "build_date": "2024-01-15T10:30:00Z"
}
```

**Compatibility Check:**

Server automatically checks protocol version on each request:

```json
// Client sends
{
  "protocol_version": "1.0.0",
  ...
}

// Server validates
// If incompatible, returns 400 Bad Request:
{
  "error": "Protocol version mismatch",
  "client_version": "1.0.0",
  "server_version": "2.0.0",
  "message": "Please update your client to v2.0.0 or later"
}
```

## Version History

### v1.0.0 (2024-01-15) - Initial Release

**Protocol Version:** 1.0.0

**New Features:**
- Zero-knowledge sync relay
- SQLite database backend
- WebSocket real-time notifications
- Rate limiting
- Health monitoring endpoints
- SLA tracking
- Docker support
- Multi-platform binaries

**API Endpoints:**
- `POST /sync/push` - Push changes
- `POST /sync/pull` - Pull changes
- `GET /health` - Health check
- `GET /version` - Version info
- `GET /metrics/sla` - SLA metrics
- `GET /regions` - Available regions
- `WS /ws` - WebSocket connection

**Client Requirements:**
- Desktop: v1.0.0+
- Web: v1.0.0+
- Mobile: v1.0.0+

**Database Schema Version:** 1

**Breaking Changes from Beta:**
- Protocol version format changed from `0.x` to `1.x`
- `/sync/push` response format standardized
- Error response format updated

**Migration from Beta:**
1. Update relay to v1.0.0
2. Update all clients to v1.0.0+
3. No data migration needed

---

### v0.9.0 (2023-12-01) - Beta Release

**Protocol Version:** 0.9.0

**Status:** Deprecated, upgrade to v1.0.0

**Features:**
- Basic sync functionality
- SQLite database
- HTTP-only endpoints (no WebSocket)

**Limitations:**
- No real-time sync
- Basic health checks only
- No SLA monitoring

**End of Support:** 2024-02-15

## Upgrade Guides

### Upgrading Relay

#### Docker

```bash
# Pull latest image
docker pull gracefulbooks/sync-relay:latest

# Stop current relay
docker-compose stop

# Update docker-compose.yml if needed
# Start new relay
docker-compose up -d

# Verify version
curl http://localhost:8787/version
```

#### Standalone Binary

1. Download new binary for your platform
2. Stop current relay
3. Replace binary
4. Start new relay
5. Verify version

#### From Source

```bash
git pull origin main
npm ci
npm run build
npm restart  # or restart your process manager
```

### Upgrading Clients

Clients auto-detect version mismatch and prompt user to update:

```
⚠️ Sync Server Update Required

Your sync server has been updated to v2.0.0, but this app is running v1.5.0.

To continue syncing, please update to the latest version.

[Update Now] [Remind Me Later]
```

**Manual Update:**

Desktop:
- Help > Check for Updates
- Or download from website

Web:
- Automatic (reload page)

Mobile:
- Update from App Store / Google Play

## Future Versions

### v1.1.0 (Planned - Q2 2024)

**New Features:**
- Enhanced compression for large payloads
- Multi-region support
- Advanced conflict resolution
- Metrics export (Prometheus format)

**Breaking Changes:** None (backward compatible)

**Client Requirements:**
- Desktop: v1.0.0+
- Web: v1.0.0+
- Mobile: v1.0.0+

**Notes:**
- Older clients will work but miss new features
- Update clients to use new features

---

### v2.0.0 (Future)

**Potential Breaking Changes:**
- New encryption algorithm
- Updated sync protocol
- Database schema changes

**Migration Path:**
- Automatic data migration on upgrade
- Client-server protocol negotiation
- Gradual rollout support

**Timeline:** TBD

## Deprecation Policy

### Support Lifecycle

Each major version is supported for:
- **Active Support:** 12 months after release
- **Security Updates:** 24 months after release
- **End of Life:** 24 months after release

### Deprecation Process

1. **Announcement:** 6 months before deprecation
2. **Warning Period:** 3 months (clients show upgrade warning)
3. **Deprecation:** Version no longer supported
4. **End of Life:** Security updates cease

### Current Status

| Version | Released | Active Until | Security Until | EOL |
|---------|----------|-------------|----------------|-----|
| 1.0.0 | 2024-01-15 | 2025-01-15 | 2026-01-15 | 2026-01-15 |
| 0.9.0 | 2023-12-01 | 2024-01-15 | 2024-02-15 | 2024-02-15 |

## Platform Support

### Relay Server

**Supported Platforms:**

| Platform | Architecture | Support Level |
|----------|-------------|---------------|
| Linux | x64 | Full |
| Linux | ARM64 | Full |
| Windows | x64 | Full |
| macOS | x64 (Intel) | Full |
| macOS | ARM64 (M1/M2) | Full |
| Docker | Multi-platform | Full |

**Minimum Requirements:**
- Node.js: 18.0.0+
- RAM: 256MB minimum, 512MB recommended
- Disk: 100MB + database growth
- OS: Ubuntu 20.04+, Windows Server 2019+, macOS 11+

### Clients

**Desktop:**
- Windows 10+
- macOS 11+
- Linux (Ubuntu 20.04+, Fedora 35+)

**Web:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Mobile:**
- iOS 14+
- Android 10+

## API Compatibility

### Endpoint Stability

| Endpoint | Stability | Notes |
|----------|-----------|-------|
| `/health` | Stable | Will not change |
| `/version` | Stable | Will not change |
| `/sync/push` | Stable | May add optional fields |
| `/sync/pull` | Stable | May add optional fields |
| `/metrics/sla` | Beta | May change in minor version |
| `/regions` | Beta | May change in minor version |
| `/ws` | Stable | Protocol may add message types |

**Stability Levels:**

- **Stable:** API contract will not break in minor versions
- **Beta:** May change with notice in minor versions
- **Experimental:** May change without notice

### Protocol Changes

Protocol changes follow semantic versioning:

**Backward Compatible Changes (Minor):**
- Adding optional request fields
- Adding response fields
- Adding new endpoints
- Adding new WebSocket message types

**Breaking Changes (Major):**
- Removing fields
- Changing field types
- Changing required fields
- Removing endpoints

## Testing Compatibility

### Before Deploying New Relay

1. **Check version compatibility**
   ```bash
   # Get current client versions
   # Desktop: Settings > About
   # Compare with relay requirements
   ```

2. **Test in staging**
   ```bash
   # Deploy relay to staging
   # Point test client to staging
   # Verify sync works
   ```

3. **Monitor for errors**
   ```bash
   # Check relay logs
   docker logs graceful-books-sync | grep ERROR

   # Check client logs for sync errors
   ```

### Before Updating Clients

1. **Verify relay compatibility**
   ```bash
   curl https://your-relay.example.com/version
   # Check protocol_version matches client
   ```

2. **Test with one device**
   - Update one device
   - Verify sync works
   - Check for errors

3. **Roll out gradually**
   - Update 10% of devices
   - Monitor for issues
   - Continue rollout

## Getting Help

**Version mismatch issues:**

1. Check current versions:
   ```bash
   # Server
   curl https://your-relay.example.com/version

   # Client
   # Settings > About
   ```

2. Compare with compatibility matrix (this document)

3. Update server or client as needed

4. Still having issues?
   - GitHub Issues: https://github.com/gracefulbooks/graceful-books/issues
   - Include both client and server versions
   - Include error messages

## Changelog

This document is updated with each relay release.

**Last Updated:** 2024-01-15 (v1.0.0 release)

**Next Review:** 2024-04-15 (or with v1.1.0 release)
