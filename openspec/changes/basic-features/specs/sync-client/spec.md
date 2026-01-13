# Capability Spec: Sync Relay Client

## Overview
The `sync-client` capability provides client-side synchronization logic for syncing encrypted data to relay servers, enabling multi-device access while maintaining zero-knowledge encryption. The sync relay acts as a "dumb pipe" that stores and forwards encrypted blobs without any ability to decrypt user data.

## ADDED Requirements

## Requirements Reference
**Spec Reference:** ARCH-003

## Functional Requirements

### Sync Operations

#### Push Operation (Upload Changes)
- **Queue local changes:**
  - Track all creates, updates, deletes
  - Assign sequence number to each change
  - Timestamp each change with device clock
  - Batch multiple changes for efficiency

- **Prepare encrypted payload:**
  - Serialize changes to JSON
  - Encrypt entire payload with user's encryption key (from Group A)
  - Add metadata: timestamp, device ID, user ID, sequence number
  - Compress payload if size >10KB (gzip)

- **Transmit to relay server:**
  - POST /sync/push with encrypted payload
  - Include authentication token (from Group A auth)
  - Set timeout: 30 seconds
  - Monitor upload progress for large payloads

- **Handle response:**
  - Success: Mark changes as synced, remove from queue
  - Conflict: Flag for conflict resolution (ARCH-004)
  - Error: Retry with exponential backoff
  - Network error: Queue for retry when connection restored

#### Pull Operation (Download Changes)
- **Request changes from server:**
  - GET /sync/pull?since=[last-sync-timestamp]
  - Include authentication token
  - Specify device ID (don't pull own changes)

- **Download encrypted payloads:**
  - Receive array of encrypted change blobs
  - Stream large payloads (>1MB)
  - Verify payload integrity (checksum)

- **Decrypt and apply:**
  - Decrypt each payload with user's encryption key
  - Deserialize JSON to change objects
  - Validate change structure
  - Apply changes to local database in transaction
  - Update last-sync-timestamp

- **Handle conflicts:**
  - Compare timestamps for same record ID
  - Use CRDT metadata for automatic merge (ARCH-004)
  - Flag complex conflicts for user review
  - Log all conflicts in audit trail

### Sync Queue Management
- **Change tracking:**
  - Observe local database for changes
  - Create queue entry for each change
  - Priority levels: Critical, High, Normal, Low
  - Deduplication: Merge multiple edits to same record

- **Queue persistence:**
  - Store queue in IndexedDB (survives app close)
  - Encrypt queue contents
  - Indexed by timestamp and priority

- **Queue processing:**
  - Process highest priority first
  - Batch up to 100 changes per push
  - Respect rate limits (max 10 pushes per minute)
  - Pause queue if offline

### Conflict Detection & Resolution
- **Conflict detection:**
  - Compare timestamps for same record
  - Local change timestamp vs. remote change timestamp
  - If |local - remote| < 5 seconds, flag as potential conflict

- **Automatic resolution (simple conflicts):**
  - Last-write-wins for most data types
  - Use CRDT merge for structural data (chart of accounts hierarchy)
  - Prefer remote changes for settings (typically admin-initiated)

- **Manual resolution (complex conflicts):**
  - Flag record for user review
  - Show both versions side-by-side
  - User chooses: Keep local, Accept remote, or Merge manually
  - Resolved conflicts logged in audit trail

### Retry Logic with Exponential Backoff
- **Retry attempts:**
  - Attempt 1: Immediate (0 seconds)
  - Attempt 2: 1 second delay
  - Attempt 3: 2 seconds delay
  - Attempt 4: 4 seconds delay
  - Attempt 5: 8 seconds delay
  - Attempt 6: 16 seconds delay
  - Attempt 7: 32 seconds delay
  - Max attempts: 7

- **Backoff strategy:**
  - Exponential backoff: delay = 2^(attempt-2) seconds
  - Jitter: Add random 0-1 second to prevent thundering herd
  - Max delay: 60 seconds (cap exponential growth)

- **Retry triggers:**
  - Network errors (ERR_NETWORK, ERR_TIMEOUT)
  - Server errors (500, 502, 503, 504)
  - Rate limit errors (429) - use longer backoff
  - Not retried: 4xx client errors (except 429)

- **User notification:**
  - After 3 failed attempts: Show warning notification
  - After 7 failed attempts: Show error notification with "Retry now" button
  - Display last error message and timestamp

### Network Status Monitoring
- **Online/offline detection:**
  - Listen to browser online/offline events
  - Periodic connectivity checks (every 30 seconds when offline)
  - Ping relay server health endpoint

- **Offline behavior:**
  - Pause sync operations
  - Continue queuing local changes
  - Show offline indicator in UI
  - Cache all data locally for offline access

- **Online behavior:**
  - Resume sync operations
  - Process queued changes
  - Pull remote changes
  - Show syncing indicator

### Sync Status Indicators
- **Visual states:**
  - **Offline:** Gray cloud icon, tooltip: "Offline - changes saved locally"
  - **Syncing:** Animated blue pulse, tooltip: "Syncing your changes..."
  - **Synced:** Green checkmark with tiny sparkle, tooltip: "Synced - Last sync: 2 minutes ago"
  - **Error:** Red warning icon, tooltip: "Sync failed - Click to retry"

- **Last sync timestamp:**
  - Display in human-friendly format: "2 minutes ago", "1 hour ago", "Yesterday"
  - Update in real-time
  - Tooltip shows exact timestamp

- **Sync progress:**
  - For large syncs, show progress bar
  - Example: "Syncing 47 of 200 changes..."
  - Estimated time remaining (if available)

### Sync Settings
- **User preferences:**
  - Auto-sync: On/Off (default: On)
  - Sync frequency: Real-time / Every 5 min / Every 15 min / Manually only
  - WiFi-only: On/Off (mobile data consideration, default: Off)
  - Conflict resolution: Automatic / Manual review

- **Admin controls:**
  - Force sync (push/pull now)
  - Clear sync queue
  - View sync history
  - Resync all data (nuclear option - full re-upload)

## Technical Requirements

### Sync Relay Server API

#### Endpoints
```
POST /sync/push
- Request: { deviceId, userId, timestamp, changes: [...] }
- Response: { status: "success", syncedCount: 47, conflicts: [...] }
- Auth: Bearer token
- Rate limit: 10 requests/minute per user

GET /sync/pull?since=<timestamp>&deviceId=<id>
- Response: { changes: [...], timestamp: "..." }
- Auth: Bearer token
- Rate limit: 30 requests/minute per user

GET /sync/status
- Response: { status: "healthy", version: "1.0.0", timestamp: "..." }
- Auth: None (public health check)
- Rate limit: 100 requests/minute per IP
```

#### Payload Format
```json
{
  "deviceId": "uuid-device-123",
  "userId": "uuid-user-456",
  "timestamp": "2026-01-10T14:30:00.000Z",
  "changes": [
    {
      "id": "uuid-record-789",
      "table": "transactions",
      "operation": "create" | "update" | "delete",
      "data": "base64-encrypted-blob",
      "version": 1,
      "timestamp": "2026-01-10T14:29:45.000Z"
    }
  ]
}
```

### Encryption Specifications
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key:** User's master encryption key (from Group A)
- **IV:** Random 12-byte nonce, unique per payload
- **Auth tag:** 16 bytes, verified on decryption
- **Payload structure:** `IV || ciphertext || auth_tag`

### Performance Requirements
- **Sync latency:** <200ms for same-region relay (P50)
- **Sync latency:** <500ms for same-region relay (P95)
- **Throughput:** Sync 100 transactions in <2 seconds
- **Queue size:** Support queue of 10,000 changes without degradation
- **Memory usage:** <50MB for sync client (including queue)
- **Battery impact:** Minimal - use efficient polling, avoid constant wake locks

### Data Integrity
- **Checksums:**
  - SHA-256 hash of each encrypted blob
  - Verify on download before decryption
  - Reject corrupted payloads

- **Sequence numbers:**
  - Incrementing sequence per device
  - Detect missing changes (gaps in sequence)
  - Request resync if gaps detected

- **Transaction safety:**
  - Apply remote changes in database transaction
  - Rollback on any error
  - Atomic: All or nothing per change batch

### Error Handling
- **Network errors:**
  - ERR_NETWORK: "No internet connection"
  - ERR_TIMEOUT: "Sync timed out - Try again"
  - ERR_REFUSED: "Cannot connect to sync server"

- **Server errors:**
  - 401 Unauthorized: "Authentication expired - Please log in again"
  - 429 Rate Limit: "Syncing too fast - Slowing down..."
  - 500 Server Error: "Sync server unavailable - Retrying..."
  - 503 Service Unavailable: "Sync service temporarily down - Will retry"

- **Data errors:**
  - Decryption failed: "Sync data corrupted - Requesting fresh copy"
  - Invalid payload: "Received invalid data - Skipping"
  - Conflict detected: "Changes conflict - Review needed"

## User Interface

### Sync Status Indicator (Top Navigation)
```
┌────────────────────┐
│ ☁️ Synced          │  ← Green cloud, hover shows tooltip
│   2 minutes ago    │
└────────────────────┘

┌────────────────────┐
│ 🔄 Syncing...      │  ← Blue animated pulse
│   47 of 200        │
└────────────────────┘

┌────────────────────┐
│ ☁️ Offline         │  ← Gray cloud
│   Changes saved    │
└────────────────────┘

┌────────────────────┐
│ ⚠️  Sync Failed    │  ← Red warning
│   Click to retry   │
└────────────────────┘
```

### Sync Settings (in Settings Page)
```
┌─────────────────────────────────────────┐
│  Sync & Backup                          │
├─────────────────────────────────────────┤
│                                          │
│  ✓ Auto-sync                            │
│    Automatically sync changes           │
│                                          │
│  Sync Frequency:  [Real-time ▼]        │
│                                          │
│  ☐ WiFi only                            │
│    Only sync on WiFi (save mobile data) │
│                                          │
│  Last sync: 2 minutes ago               │
│  Status: ✓ All changes synced          │
│                                          │
│  [Sync Now]  [View Sync History]       │
│                                          │
└─────────────────────────────────────────┘
```

### Sync Error Notification
```
┌────────────────────────────────────────────┐
│  ⚠️  Sync Failed                           │
│                                             │
│  We couldn't sync your latest changes to   │
│  the cloud. Don't worry - everything is    │
│  saved on this device.                     │
│                                             │
│  Error: Network timeout                    │
│  Last successful sync: 15 minutes ago      │
│                                             │
│  [Try Again]  [View Details]  [Dismiss]    │
└────────────────────────────────────────────┘
```

## Dependencies

### Requires (from Group A)
- `encryption` - AES-256-GCM encryption/decryption
- `data-store` - Local database access for change detection
- `auth` - Authentication tokens for API requests

### Requires (Infrastructure)
- Sync relay server (deployed separately)
- Network connectivity
- Device clock synchronization (NTP)

### Provides to
- Multi-device access for all data (accounts, transactions, profiles)
- Offline capability with automatic sync when online
- Real-time collaboration foundation (enhanced in Group I)

## Success Metrics
- Sync success rate: >99.5% (excluding network unavailability)
- Sync latency (P95): <500ms same region
- Conflict rate: <1% of all syncs
- Auto-resolution rate: >90% of conflicts
- User-reported sync issues: <0.5% of users
- Offline capability: 100% of features work offline
- Sync queue processing: <5 seconds for 100 changes

## Security Considerations
- **Zero-knowledge maintained:**
  - Relay server never sees unencrypted data
  - Encryption keys never transmitted
  - Payload inspection reveals only metadata (user ID, timestamp, size)

- **Attack vectors mitigated:**
  - Man-in-the-middle: TLS 1.3 + payload encryption
  - Replay attack: Timestamp validation, sequence numbers
  - Tampering: Authenticated encryption (GCM mode)
  - Data leakage: All data encrypted at rest and in transit

- **Rate limiting:**
  - Prevent denial of service
  - Prevent abuse of sync infrastructure
  - Per-user and per-IP limits

## Monitoring & Observability
- **Client-side metrics:**
  - Sync success/failure rate
  - Sync latency distribution
  - Conflict rate
  - Queue size over time
  - Retry attempts distribution

- **Server-side metrics:**
  - Request rate (push/pull)
  - Error rate by type
  - Payload size distribution
  - Active device count per user
  - Storage usage per user

- **Logging:**
  - All sync operations logged locally (encrypted)
  - Error details captured for debugging
  - Sync history viewable by user
  - Admin dashboard for support (aggregated, anonymized)

## Testing Strategy
- **Unit tests:**
  - Encryption/decryption round-trip
  - Queue management operations
  - Retry logic timing
  - Conflict detection algorithm

- **Integration tests:**
  - Push/pull operations with mock server
  - Offline/online transitions
  - Multi-device scenarios
  - Large payload handling

- **E2E tests:**
  - Create transaction on Device A, see on Device B
  - Edit same record on two devices simultaneously
  - Sync after 48-hour offline period
  - Network interruption during sync

- **Performance tests:**
  - Sync 10,000 changes (measure time, memory)
  - Queue buildup under high write load
  - Sync latency under various network conditions

## Future Enhancements (Beyond Group B)
- Peer-to-peer sync (direct device-to-device on same network) - ARCH-003
- Selective sync (choose which data types to sync)
- Sync conflict history viewer with detailed diff
- Sync analytics (which devices sync most, when)
- Background sync (service worker for offline PWA)
- Delta sync (only send changed fields, not entire records)
- Compression improvements (better algorithms for financial data)
- Multi-region relay (automatic geo-routing for lower latency)
