# Migration Guide: Hosted to Self-Hosted

This guide walks you through migrating from Graceful Books hosted sync relay to your own self-hosted instance.

**Why migrate?**
- Complete data sovereignty
- No monthly sync fees
- Custom infrastructure control
- Private network deployment

**What this involves:**
1. Set up your self-hosted relay
2. Export data from hosted relay
3. Configure clients to use new relay
4. Verify synchronization
5. Disable hosted relay

**Estimated time:** 30-60 minutes

## Table of Contents

1. [Before You Begin](#before-you-begin)
2. [Prerequisites](#prerequisites)
3. [Migration Steps](#migration-steps)
4. [Verification](#verification)
5. [Rollback Plan](#rollback-plan)
6. [FAQ](#faq)

## Before You Begin

### Important Considerations

**Data Security:**
- All data remains encrypted throughout migration
- Your encryption keys never leave your devices
- The hosted relay cannot decrypt your data
- The self-hosted relay cannot decrypt your data

**Zero Downtime:**
- Clients can sync with either relay during transition
- No data loss if done correctly
- Can revert to hosted relay if issues arise

**What Gets Migrated:**

✅ **Included:**
- All encrypted sync data
- Sync history (last 30 days)
- Device registrations
- Version vectors

❌ **Not Included:**
- Server logs (not needed)
- Analytics data (local to hosted relay)
- Rate limit state (resets on migration)

### Migration Checklist

Before starting, ensure you have:

- [ ] Self-hosted relay set up and running
- [ ] Self-hosted relay accessible from all devices
- [ ] HTTPS configured (recommended)
- [ ] All devices on latest client version
- [ ] Backup of current data
- [ ] 1-2 hour maintenance window (for peace of mind)

## Prerequisites

### 1. Set Up Self-Hosted Relay

Follow the [Self-Hosted Setup Guide](./SELF_HOSTED_SETUP.md) to install your relay.

**Quick verification:**

```bash
curl https://your-relay.example.com/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "1.0.0"
}
```

### 2. Verify Compatibility

Check that your client version is compatible:

**In Graceful Books app:**
1. Go to Settings > About
2. Check "Version" (e.g., v1.2.0)
3. Verify against [Version Compatibility Matrix](./VERSION_COMPATIBILITY.md)

**Minimum versions:**
- Desktop: v1.0.0+
- Web: v1.0.0+
- Mobile: v1.0.0+

### 3. Backup Current Data

**On each device:**

1. Open Graceful Books
2. Go to Settings > Data > Export
3. Save backup file to safe location
4. Verify backup file is readable

This backup is insurance - you likely won't need it.

## Migration Steps

### Step 1: Export Data from Hosted Relay

**Why:** Get a snapshot of all sync data to import into self-hosted relay.

**How:**

1. Log into Graceful Books account dashboard: https://app.gracefulbooks.com/account

2. Navigate to "Sync Settings"

3. Click "Export Sync Data"

4. Download `sync-export-YYYY-MM-DD.json`

**What's in the export:**

```json
{
  "version": "1.0.0",
  "export_date": "2024-01-15T10:30:00Z",
  "user_id": "user-123",
  "devices": [...],
  "changes": [...]
}
```

All data is still encrypted - the export is just moving encrypted blobs.

### Step 2: Import Data to Self-Hosted Relay

**Using CLI tool:**

```bash
# Download import tool
curl -o import-sync-data.sh https://raw.githubusercontent.com/gracefulbooks/graceful-books/main/relay/scripts/import-sync-data.sh
chmod +x import-sync-data.sh

# Run import
./import-sync-data.sh \
  --relay-url https://your-relay.example.com \
  --export-file sync-export-2024-01-15.json
```

**Manual import (Docker):**

```bash
# Copy export file to container
docker cp sync-export-2024-01-15.json graceful-books-sync:/tmp/

# Run import script
docker exec graceful-books-sync node /app/scripts/import.js /tmp/sync-export-2024-01-15.json
```

**Expected output:**

```
✓ Validating export file...
✓ Connecting to database...
✓ Importing devices (3 found)...
✓ Importing changes (847 found)...
✓ Rebuilding indexes...
✓ Import complete!

Summary:
  Devices: 3 imported
  Changes: 847 imported
  Duration: 2.3s
```

### Step 3: Configure First Device

**Choose your primary device** (e.g., desktop computer) to switch first.

**In Graceful Books app:**

1. Go to **Settings > Sync**

2. Click **Advanced > Custom Sync Server**

3. Enter your relay URL:
   ```
   https://your-relay.example.com
   ```

4. Click **Test Connection**
   - Should show ✓ "Connected successfully"
   - Version should match

5. Click **Switch to This Server**

6. Confirm dialog: "Switch sync relay?"

**Behind the scenes:**
- App fetches latest changes from new relay
- Verifies encryption keys still work
- Merges any local changes since export
- Uploads any new local changes

**First sync may take 1-2 minutes** depending on data size.

### Step 4: Verify First Device

After switching:

1. Check sync status: Settings > Sync
   - Should show "Last synced: Just now"
   - Server should show your relay URL

2. Make a test change:
   - Create a new transaction
   - Wait 5 seconds
   - Check sync status again

3. Verify in relay logs:

```bash
# Docker
docker logs graceful-books-sync --tail 50

# Should see:
# [INFO] Sync push received from device-abc (3 changes)
# [INFO] Sync push completed (3 changes accepted)
```

### Step 5: Configure Remaining Devices

**For each additional device:**

1. Open Graceful Books

2. Go to Settings > Sync > Custom Sync Server

3. Enter: `https://your-relay.example.com`

4. Click **Switch to This Server**

5. Wait for initial sync to complete

6. Verify test transaction from Step 4 appears

**Tip:** Switch devices one at a time, verifying each before proceeding.

### Step 6: Final Verification

**Check all devices see the same data:**

1. On Device A: Note total number of transactions
2. On Device B: Verify same transaction count
3. On Device C: Verify same transaction count

**Create and sync a test transaction:**

1. On Device A: Create transaction "Migration Test"
2. Wait 10 seconds
3. On Device B: Verify "Migration Test" appears
4. On Device C: Verify "Migration Test" appears

**If everything matches:** Migration successful!

### Step 7: Disable Hosted Sync (Optional)

Once confident in self-hosted relay:

1. Log into https://app.gracefulbooks.com/account

2. Go to Sync Settings

3. Click "Disable Hosted Sync"

4. Confirm dialog

**This is optional** - hosted sync can remain as backup.

## Verification

### Health Checks

Verify self-hosted relay is healthy:

```bash
# Health status
curl https://your-relay.example.com/health

# SLA metrics
curl https://your-relay.example.com/metrics/sla

# Should show recent activity
```

### Database Verification

Check database has expected data:

```bash
# Docker
docker exec graceful-books-sync sqlite3 /app/data/sync.db "SELECT COUNT(*) FROM sync_changes;"

# Should return count close to export count
```

### Client Logs

Check for sync errors in client logs:

**Desktop (Windows):**
```
%APPDATA%\Graceful Books\logs\sync.log
```

**Desktop (Mac):**
```
~/Library/Application Support/Graceful Books/logs/sync.log
```

**Desktop (Linux):**
```
~/.config/graceful-books/logs/sync.log
```

Look for:
- ✓ "Sync completed successfully"
- ✗ "Sync failed" or "Connection error"

## Rollback Plan

If issues arise, you can revert to hosted sync:

### Quick Rollback

**On each device:**

1. Go to Settings > Sync > Advanced

2. Click "Use Graceful Books Hosted Sync"

3. Click "Switch"

4. Verify sync resumes

### Full Rollback

If self-hosted relay is completely inaccessible:

1. **Stop all devices from syncing** (prevent conflicts)

2. **Restore from backup** on each device:
   - Settings > Data > Import
   - Select backup file from "Before You Begin"

3. **Re-enable hosted sync** as above

4. **Verify data integrity** on all devices

## Troubleshooting

### "Connection failed" when testing relay

**Check:**
- Relay is running: `curl https://your-relay.example.com/health`
- Firewall allows port 8787 (or your port)
- DNS resolves correctly: `nslookup your-relay.example.com`
- HTTPS certificate is valid

### "Version mismatch" error

**Cause:** Client and relay have incompatible versions

**Fix:**
- Update client to latest version, or
- Update relay to latest version
- See [Version Compatibility Matrix](./VERSION_COMPATIBILITY.md)

### "Import failed: Database locked"

**Cause:** Relay is running during import

**Fix:**
```bash
# Stop relay
docker-compose stop

# Run import
./import-sync-data.sh ...

# Start relay
docker-compose up -d
```

### Devices show different transaction counts

**Cause:** Sync hasn't completed yet

**Fix:**
1. Wait 1-2 minutes for sync to complete
2. Manually trigger sync: Settings > Sync > Sync Now
3. Check relay logs for errors

### "Encryption error" after migration

**Cause:** Export was corrupted or incompatible

**Fix:**
1. Rollback to hosted sync (see above)
2. Re-export data from hosted relay
3. Verify export file integrity:
   ```bash
   jq '.' sync-export-2024-01-15.json > /dev/null
   ```
4. Try import again

## Post-Migration

### Monitoring Setup

Set up monitoring to ensure relay stays healthy:

1. Configure health checks: [Health Check Documentation](./HEALTH_CHECKS.md)
2. Set up alerts: [Alerting Guide](./HEALTH_CHECKS.md#alerting)
3. Monitor SLA metrics: `/metrics/sla`

### Backup Strategy

Schedule regular backups:

```bash
# Backup database daily at 2 AM
0 2 * * * docker exec graceful-books-sync sqlite3 /app/data/sync.db ".backup /app/data/backup-$(date +\%Y\%m\%d).db"

# Cleanup old backups (keep 30 days)
0 3 * * * find /path/to/backups -name "backup-*.db" -mtime +30 -delete
```

### Performance Tuning

Monitor and optimize:

1. Check database size: `du -h /path/to/sync.db`
2. Review cleanup settings: `DB_CLEANUP_DAYS`
3. Adjust rate limits: `MAX_REQUESTS_PER_MINUTE`
4. Monitor resource usage: `docker stats graceful-books-sync`

## FAQ

**Q: Can I migrate back to hosted sync later?**

A: Yes, the process is reversible. Simply switch clients back to hosted sync.

**Q: Will I lose any data during migration?**

A: No, if you follow this guide. The export includes all sync data, and clients retain local data.

**Q: Do all devices need to migrate at the same time?**

A: No, you can migrate devices gradually. However, once a device switches to self-hosted, it won't sync with devices still on hosted relay.

**Q: Can I keep using hosted sync as a backup?**

A: Not simultaneously. Clients sync with one relay at a time. You can keep the hosted account active but not actively syncing.

**Q: What if my self-hosted relay goes down?**

A: Clients continue working offline and will sync when relay comes back online. No data is lost.

**Q: Is the migration reversible?**

A: Yes, follow the [Rollback Plan](#rollback-plan) above.

**Q: How long does migration take?**

A: Typically 30-60 minutes for setup + 5-10 minutes per device to switch.

**Q: Do I need to pay for anything?**

A: No, self-hosted relay is free to run. You only pay for your own hosting costs (server, domain, etc.).

## Support

Need help with migration?

- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/gracefulbooks/graceful-books/issues)
- [Community Forum](https://community.gracefulbooks.com)
- [Documentation](https://docs.gracefulbooks.com/self-hosted)

**Before posting for help, gather:**
1. Relay logs: `docker logs graceful-books-sync`
2. Client version: Settings > About
3. Relay version: `curl https://your-relay.example.com/version`
4. Error messages (screenshots if possible)
