# Smart Auto-Backup System 💜✨

**Complete local-first backup solution with gorgeous purple/gold branding**

## What's Included

### 🎯 Core Service
- **SmartAutoBackupService.ts** - Intelligent backup engine with:
  - Change detection (only backup when data changes)
  - Smart timing (after X changes or Y minutes)
  - File rotation (keeps ~47 backups instead of thousands)
  - Before-unload safety (backup before closing browser)

### 🎨 UI Components
- **DataRecoveryModal** - Beautiful recovery interface when browser data cleared
- **BackupStatusIndicator** - Subtle notification when backups complete
- All styled with royal purple (#4b006e) + gold (#d4af37) - **NO BLUE!**

### 🔧 Integration Tools
- **useDataRecovery** - Hook to detect empty database and trigger recovery
- **INTEGRATION_EXAMPLE.tsx** - Complete examples of how to use everything

---

## Quick Start (5 Minutes)

### Step 1: Start Auto-Backup in App

```tsx
// In your App.tsx or main layout
import { useEffect } from 'react';
import { smartAutoBackup } from './services/backup/SmartAutoBackupService';
import { BackupStatusIndicator } from './components/backup/BackupStatusIndicator';

export function App() {
  // Start auto-backup on mount
  useEffect(() => {
    smartAutoBackup.start({
      enabled: true,
      frequency: 'normal', // or 'aggressive' or 'conservative'
    });

    return () => smartAutoBackup.stop();
  }, []);

  return (
    <>
      {/* Your app content */}
      <YourAppContent />

      {/* Shows "Data Backed Up" notification */}
      <BackupStatusIndicator />
    </>
  );
}
```

### Step 2: Add Data Recovery Modal

```tsx
// In your App.tsx
import { useDataRecovery } from './hooks/useDataRecovery';
import { DataRecoveryModal } from './components/backup/DataRecoveryModal';

export function App() {
  const recovery = useDataRecovery();

  return (
    <>
      <YourAppContent />
      <BackupStatusIndicator />

      {/* Automatically shows if database is empty */}
      {recovery.needsRecovery && (
        <DataRecoveryModal
          onRestore={async (fileHandle) => {
            await recovery.restoreFromBackup(fileHandle);
            window.location.reload(); // Refresh app with restored data
          }}
          onDismiss={recovery.dismissRecovery}
        />
      )}
    </>
  );
}
```

### Step 3: Done! 🎉

That's it! Your app now has:
- ✅ Automatic backups every 5 minutes (when data changes)
- ✅ Smart file rotation (keeps ~140MB instead of growing forever)
- ✅ Beautiful recovery UI if user clears browser data
- ✅ Subtle backup notifications

---

## How It Works

### Backup Strategy

**When backups happen:**
1. Every 10 changes (transactions, edits, etc.)
2. Every 5 minutes (if there were changes)
3. Before user closes browser tab

**File rotation keeps:**
- Last 12 backups (1 hour worth)
- One per hour for last 24 hours
- One per day for last 7 days
- One per week for last 4 weeks

**Total: ~47 files ≈ 140MB**

### Storage Optimization

**Smart features:**
- Only backs up when data actually changed (hash comparison)
- Skips backups if nothing changed
- Auto-deletes old backups
- Keeps important backups (recent, hourly, daily, weekly)

---

## Customization

### Backup Frequency Options

```tsx
// Aggressive: Every 5 changes or 1 minute
smartAutoBackup.start({ frequency: 'aggressive' });

// Normal: Every 10 changes or 5 minutes (default)
smartAutoBackup.start({ frequency: 'normal' });

// Conservative: Every 25 changes or 15 minutes
smartAutoBackup.start({ frequency: 'conservative' });
```

### Manual Backup

```tsx
// Trigger backup immediately
const result = await smartAutoBackup.backupNow();
if (result.success) {
  console.log('Backup complete!');
}
```

### Get Backup Stats

```tsx
const stats = await smartAutoBackup.getStats();
console.log('Total backups:', stats.totalBackups);
console.log('Last backup:', new Date(stats.lastBackupTime));
console.log('Changes since backup:', stats.changesSinceBackup);
```

---

## User Settings Example

Add this to your settings page:

```tsx
import { smartAutoBackup } from './services/backup/SmartAutoBackupService';

function BackupSettings() {
  const [settings, setSettings] = useState(smartAutoBackup.getSettings());

  return (
    <div>
      <h3>Automatic Backup</h3>

      {/* Enable/Disable */}
      <label>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => {
            const newSettings = { ...settings, enabled: e.target.checked };
            smartAutoBackup.updateSettings(newSettings);
            setSettings(newSettings);
          }}
        />
        Enable automatic backups
      </label>

      {/* Frequency */}
      {settings.enabled && (
        <select
          value={settings.frequency}
          onChange={(e) => {
            const newSettings = { ...settings, frequency: e.target.value };
            smartAutoBackup.updateSettings(newSettings);
            setSettings(newSettings);
          }}
        >
          <option value="aggressive">Aggressive</option>
          <option value="normal">Normal (Recommended)</option>
          <option value="conservative">Conservative</option>
        </select>
      )}

      {/* Manual Backup */}
      <button onClick={() => smartAutoBackup.backupNow()}>
        Backup Now
      </button>
    </div>
  );
}
```

---

## Files Created

```
src/
├── services/backup/
│   ├── SmartAutoBackupService.ts      (Main backup engine)
│   ├── FileSystemBackup.ts            (Already existed - file operations)
│   └── BackupEncryption.ts            (Already existed - encryption)
├── components/backup/
│   ├── DataRecoveryModal.tsx          (Recovery UI)
│   ├── DataRecoveryModal.module.css   (Gorgeous purple/gold styles)
│   ├── BackupStatusIndicator.tsx      (Notification UI)
│   ├── BackupStatusIndicator.module.css (Notification styles)
│   ├── INTEGRATION_EXAMPLE.tsx        (How to use everything)
│   └── README.md                      (This file)
└── hooks/
    └── useDataRecovery.ts              (Recovery detection hook)
```

---

## Testing the Flow

### Test Auto-Backup
1. Make a transaction
2. Wait 5 minutes or make 10 changes
3. Check your backup folder - new file appears
4. See subtle "Data Backed Up" notification

### Test Recovery
1. Open browser DevTools → Application → Storage
2. Click "Clear site data"
3. Refresh the app
4. Beautiful purple recovery modal appears
5. Select latest backup → click "Restore My Books"
6. All data restored! 🎉

### Test File Rotation
1. Let app run for a few days
2. Check backup folder
3. Should have ~47 files (not thousands)
4. Recent backups every 5 min, old backups less frequent

---

## Brand Colors Used

**Royal Purple:**
- Primary: `#4b006e`
- Dark: `#3a0054`
- Light: `rgba(75, 0, 110, 0.03)`

**Gold:**
- Primary: `#d4af37`
- Light: `#e6c766`

**Neutral:**
- White: `#ffffff`
- Gray: `#8c8c8c`, `#f0f0f0`, `#fafafa`
- Text: `#262626`, `#595959`

**NO BLUE ANYWHERE!** ✅

---

## What Makes This Special

🎯 **Smart, not dumb** - Only backs up when needed
💜 **Beautiful** - On-brand purple/gold design
⚡ **Fast** - Change detection = instant checks
💾 **Efficient** - 140MB total, not growing forever
😌 **Reassuring** - Calm messaging, no scary errors
✨ **Delightful** - Smooth animations, satisfying UX
🛡️ **Safe** - Encrypted backups, local sovereignty

---

## Support

Questions? Check `INTEGRATION_EXAMPLE.tsx` for complete working examples.

Need help? The code is well-documented with JSDoc comments throughout.

---

**Built with love for Audacious Money** 💜✨
