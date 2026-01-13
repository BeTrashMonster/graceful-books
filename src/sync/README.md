# Sync Module

The sync module implements encrypted relay sync for Graceful Books using CRDT infrastructure.

## Overview

This module provides client-side synchronization of encrypted data with relay servers, enabling multi-device support while maintaining zero-knowledge encryption.

## Architecture

```
┌─────────────────┐
│  Sync Client    │  Main sync orchestrator
└────────┬────────┘
         │
    ┌────┼────┬─────────┬──────────┐
    │    │    │         │          │
    v    v    v         v          v
 Queue Proto  Conflict  API      CRDT
              Resolution         (A3)
```

## Components

### 1. Sync Queue (`syncQueue.ts`)
Manages a persistent queue of local changes waiting to be synced.

**Features:**
- Persistent storage in localStorage
- Retry logic with exponential backoff
- Status tracking (pending, in-progress, completed, failed)
- Batch operations

**Usage:**
```typescript
import { syncQueue, SyncEntityType, SyncOperationType } from './sync';

syncQueue.enqueue(
  SyncEntityType.ACCOUNT,
  'account-123',
  SyncOperationType.UPDATE,
  encryptedPayload
);
```

### 2. Sync Protocol (`syncProtocol.ts`)
Defines the wire protocol for communication with relay servers.

**Features:**
- Push/pull request/response formats
- Protocol versioning
- Payload validation
- Batch management
- Conflict detection

**Message Types:**
- `PUSH` - Send local changes to remote
- `PULL` - Retrieve remote changes
- `ACK` - Acknowledge receipt
- `ERROR` - Error responses

### 3. Conflict Resolution (`conflictResolution.ts`)
Handles merge conflicts using CRDT algorithms from A3.

**Strategies:**
- `AUTO` - Automatic Last-Write-Wins (default)
- `LOCAL_WINS` - Always prefer local changes
- `REMOTE_WINS` - Always prefer remote changes
- `MANUAL` - Require manual resolution

**Features:**
- Leverages CRDT version vectors
- Automatic conflict detection
- Merge statistics
- Validation

### 4. Sync Client (`syncClient.ts`)
Main synchronization client that orchestrates all sync operations.

**Features:**
- Automatic background sync
- Manual sync triggers
- Offline mode support
- State management with listeners
- Configurable intervals and batch sizes

**Usage:**
```typescript
import { createSyncClient } from './sync';

const client = createSyncClient({
  auto_sync: true,
  sync_interval_ms: 30000,
  batch_size: 10,
});

// Manual sync
const result = await client.sync();

// Listen to state changes
client.addListener(state => {
  console.log('Sync status:', state.status);
});
```

### 5. Mock Sync API (`../api/syncApi.ts`)
Mock relay server implementation for testing and development.

**Features:**
- Uses localStorage as mock server
- Simulates network delays
- Random failure simulation
- Duplicate detection

## React Integration

### Hooks

#### `useSync()`
Main hook for sync functionality.

```typescript
import { useSync } from '@/hooks/useSync';

function MyComponent() {
  const {
    state,
    isSyncing,
    sync,
    queueChange,
    setOfflineMode,
  } = useSync();

  return (
    <button onClick={sync} disabled={isSyncing}>
      {isSyncing ? 'Syncing...' : 'Sync Now'}
    </button>
  );
}
```

#### `useSyncStatus()`
Lightweight hook for displaying sync status.

```typescript
import { useSyncStatus } from '@/hooks/useSyncStatus';

function SyncBadge() {
  const { statusText, statusColor, pendingCount } = useSyncStatus();

  return (
    <div className={`badge badge-${statusColor}`}>
      {statusText} ({pendingCount} pending)
    </div>
  );
}
```

### Components

#### `<SyncIndicator />`
Visual indicator showing current sync status.

```typescript
import { SyncIndicator } from '@/components/sync';

<SyncIndicator showText showPending />
```

#### `<SyncSettings />`
Full sync configuration and statistics panel.

```typescript
import { SyncSettings } from '@/components/sync';

<SyncSettings />
```

## Testing

All sync modules have comprehensive test coverage (69 tests, 100% passing).

### Run Tests
```bash
npm test src/sync
```

### Test Coverage
- Sync Queue: 19 tests
- Sync Protocol: 19 tests
- Conflict Resolution: 15 tests
- Sync Client: 16 tests

## Configuration

### Sync Client Config

```typescript
interface SyncConfig {
  auto_sync: boolean;           // Enable automatic sync
  sync_interval_ms: number;     // Sync interval in milliseconds
  batch_size: number;           // Max items per batch
  max_retries: number;          // Max retry attempts
  conflict_strategy: ConflictStrategy;
  offline_mode: boolean;        // Disable all sync
}
```

### Default Configuration

```typescript
{
  auto_sync: true,
  sync_interval_ms: 30000,      // 30 seconds
  batch_size: 10,
  max_retries: 3,
  conflict_strategy: ConflictStrategy.AUTO,
  offline_mode: false,
}
```

## Sync Flow

```
1. Local Change Detected
   ↓
2. Queue Item Created
   ↓
3. Auto-Sync Timer Triggers (or manual sync)
   ↓
4. Push Phase:
   - Get pending items
   - Batch changes
   - Create push request
   - Send to relay server
   - Mark accepted as completed
   - Mark rejected as failed
   ↓
5. Pull Phase:
   - Create pull request
   - Receive remote changes
   - Apply to local database
   - Resolve conflicts (CRDT)
   - Update sync vector
   ↓
6. Update Sync State
   ↓
7. Notify Listeners
```

## Security

- All data is encrypted before leaving the device
- Relay servers cannot decrypt data
- Zero-knowledge architecture maintained
- Version vectors prevent replay attacks
- Device ID tracked for audit

## Future Enhancements

- [ ] Production relay server integration
- [ ] WebSocket support for real-time sync
- [ ] Compression for large payloads
- [ ] Selective sync (per-entity type)
- [ ] Bandwidth optimization
- [ ] P2P sync for local networks
- [ ] Sync conflict UI for manual resolution

## Dependencies

- `../db/crdt` - CRDT infrastructure from A3
- `../types/database.types` - TypeScript types
- `../api/syncApi` - Mock sync API

## Related Documentation

- [CRDT Module](../db/README.md)
- [Database Schema](../db/schema/)
- [ROADMAP.md](../../ROADMAP.md) - B6: Sync Relay Client

## Support

For issues or questions about the sync system:
1. Check test files for usage examples
2. Review inline documentation
3. See ROADMAP.md for implementation details
