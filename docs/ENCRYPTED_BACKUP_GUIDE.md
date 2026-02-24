# Encrypted Backup & Restore Guide

**For Graceful Books Users**

This guide helps you understand how to protect your financial data with encrypted backups and restore it when needed.

---

## What is an Encrypted Backup?

An encrypted backup is a secure copy of all your company's financial data, protected with a passphrase that only you know. Think of it as a locked safe that only you have the key to.

### What's included in your backup?

When you create a backup, it includes:
- All accounts and your chart of accounts
- All transactions and journal entries
- Contacts (customers and vendors)
- Products and services
- Company settings and preferences
- CPG tool data and calculations (if you use that feature)
- Audit trail records

### Why use encrypted backups?

1. **Data Protection**: Protects against accidental data loss
2. **Peace of Mind**: Keep a copy of your records safe, just in case
3. **Migration**: Move your data to a new device or computer
4. **Compliance**: Some industries require regular data backups
5. **Zero-Knowledge**: Your backup is encrypted with your passphrase—we can't access it

---

## Creating a Backup

### Step-by-Step Instructions

1. **Open Settings**
   - Navigate to Settings in your Graceful Books account
   - Look for "Encrypted Backup & Restore" option

2. **Choose a Strong Passphrase**
   - Use at least 12 characters
   - Mix letters, numbers, and symbols
   - Make it memorable but unique
   - Example: "MyBusiness2024$afe!"
   - **Important**: Write this down and store it safely!

3. **Create Your Backup**
   - Click "Create Encrypted Backup"
   - Enter your passphrase twice (to make sure it's correct)
   - Click "Create Encrypted Backup" button
   - Your backup will download automatically

4. **Store Your Backup Safely**
   - Save the file somewhere secure (see storage tips below)
   - Keep your passphrase separate from the file
   - Consider keeping multiple copies in different locations

### Backup File Details

- **File Name**: `graceful-books-backup-YYYY-MM-DD-HHMMSS.gbbackup`
- **File Type**: Encrypted JSON file
- **Size**: Varies based on your data (typically 1-10 MB)
- **Encryption**: AES-256-GCM (military-grade encryption)

---

## Safe Storage Recommendations

### Where to Store Your Backup

✅ **Recommended:**
- Cloud storage (Google Drive, Dropbox, OneDrive) with strong password
- External hard drive stored in a different location
- USB flash drive in a safe or locked drawer
- Multiple copies in different secure locations

❌ **Not Recommended:**
- Desktop or Downloads folder only (risk of accidental deletion)
- Email to yourself (email can be compromised)
- Shared network drives (unless encrypted)
- Public cloud storage without encryption

### Where to Store Your Passphrase

✅ **Recommended:**
- Password manager (1Password, LastPass, Bitwarden)
- Written down and stored in a physical safe
- Encrypted notes app with separate password
- Shared with trusted business partner (in separate secure location)

❌ **Not Recommended:**
- Same location as the backup file
- Plain text file on your computer
- Sticky note on your monitor
- Unencrypted email or cloud document

### Best Practice: 3-2-1 Rule

Follow the "3-2-1" backup rule:
- **3** copies of your data (original + 2 backups)
- **2** different types of storage media (e.g., cloud + external drive)
- **1** copy stored off-site (different physical location)

---

## Restoring from a Backup

### When to Restore

You might need to restore from a backup if:
- You're setting up Graceful Books on a new device
- You accidentally deleted important data
- Your device crashed or was lost/stolen
- You need to revert to a previous state of your data

### Step-by-Step Restore Instructions

1. **Open Restore Interface**
   - Navigate to Settings
   - Click "Encrypted Backup & Restore"
   - Click "Restore Backup" tab

2. **Select Your Backup File**
   - Click "Choose Backup File"
   - Navigate to where you stored your backup
   - Select your `.gbbackup` file
   - The system will verify it's a valid backup

3. **Enter Your Passphrase**
   - Enter the same passphrase you used to create the backup
   - Make sure there are no typos
   - The system will test if it can decrypt the backup

4. **Review Backup Information**
   - Check the backup date to ensure it's the right one
   - Review what's included (number of accounts, transactions, etc.)

5. **Restore Your Data**
   - Click "Restore from Backup"
   - Wait for the process to complete (usually 10-30 seconds)
   - **Warning**: This will replace your current data!

6. **Refresh and Verify**
   - Refresh your browser page
   - Check that your data has been restored correctly
   - Verify a few key transactions or accounts

### Troubleshooting Restore Issues

**"The passphrase doesn't match"**
- Double-check your passphrase for typos
- Check if Caps Lock is on
- Try copying from your password manager
- Verify you're using the right backup file

**"This backup file is not valid"**
- Ensure the file hasn't been corrupted
- Check that you downloaded the complete file
- Verify the file extension is `.gbbackup`
- Try downloading the backup from your storage again

**"Failed to decrypt the backup"**
- The file may have been corrupted
- The passphrase may be incorrect
- The file may have been modified
- Contact support if you continue to have issues

---

## Backup Schedule Recommendations

### How Often Should You Back Up?

The frequency depends on your business activity:

**Daily Backups:**
- High-volume businesses (100+ transactions/day)
- Multiple users entering data
- During tax season or busy periods

**Weekly Backups:**
- Medium-volume businesses (20-100 transactions/week)
- Single user or small team
- Regular business operations

**Monthly Backups:**
- Low-volume businesses (few transactions/month)
- Seasonal businesses during off-season
- Minimum recommended frequency

**Before Major Events:**
- Year-end closing
- Before importing large data sets
- Before major software updates
- Before changing company structure

### Automated Reminders

Consider setting up reminders:
1. Add a recurring calendar event for your backup schedule
2. Set a monthly phone reminder
3. Include backup creation in your month-end checklist
4. Set up a desktop reminder

---

## Security Best Practices

### Passphrase Security

1. **Use a Strong Passphrase**
   - Minimum 12 characters
   - Include uppercase, lowercase, numbers, and symbols
   - Avoid common words or phrases
   - Don't use personal information (birthdays, names)

2. **Keep Your Passphrase Secret**
   - Don't share it via email or text
   - Don't write it where others can see it
   - Use a password manager for secure storage
   - Change it periodically (annually is good)

3. **If You Forget Your Passphrase**
   - **Important**: We cannot recover your passphrase
   - This is by design—zero-knowledge encryption
   - You will not be able to restore that backup
   - This is why writing it down securely is critical

### File Security

1. **Protect Your Backup Files**
   - Store in encrypted cloud storage when possible
   - Use strong passwords for your cloud accounts
   - Enable two-factor authentication (2FA) on cloud accounts
   - Encrypt external drives that store backups

2. **Verify Backup Integrity**
   - Periodically test restoring to a test environment
   - Check file size—corrupted files may be smaller
   - Keep multiple backup versions (weekly for a month)

3. **Delete Old Backups Securely**
   - Don't just move to trash—permanently delete
   - Overwrite files on external drives
   - Remove from all cloud storage locations
   - Follow your data retention policy

---

## Compliance and Legal Considerations

### Data Retention Requirements

Different jurisdictions and industries have different requirements:

- **General Business**: 7 years for tax records (IRS requirement)
- **Healthcare**: HIPAA may require longer retention
- **Financial Services**: SEC may require specific retention
- **Check Your Local Laws**: Requirements vary by location

### Audit Trail

Your backups include audit logs showing:
- Who made changes to financial data
- When changes were made
- What was changed
- Previous values (for some fields)

This audit trail is important for:
- Compliance requirements
- Fraud prevention
- Resolving disputes
- Understanding data history

---

## Advanced Features

### Multiple Passphrases

You can use different passphrases for different backups:
- Monthly backups with one passphrase
- Year-end backups with a different, highly secure passphrase
- Test backups with a simple passphrase

**Important**: Keep track of which passphrase goes with which backup!

### Selective Restore (Coming Soon)

Future versions may support:
- Restoring specific date ranges
- Restoring only certain types of data
- Merging backup data with current data
- Comparing backups before restoring

---

## Frequently Asked Questions

### General Questions

**Q: How long does it take to create a backup?**
A: Usually 5-15 seconds, depending on the size of your data.

**Q: Can I create a backup on one device and restore on another?**
A: Yes! That's one of the main uses for backups.

**Q: What if I lose both my backup and passphrase?**
A: Unfortunately, there's no way to recover an encrypted backup without the passphrase. This is the tradeoff for zero-knowledge security—your data is truly private.

**Q: Can Graceful Books support help me if I forget my passphrase?**
A: No. By design, we never have access to your passphrase. This ensures your financial data remains private.

### Technical Questions

**Q: What encryption is used?**
A: AES-256-GCM (Advanced Encryption Standard with 256-bit keys in Galois/Counter Mode). This is military-grade encryption.

**Q: Can the backup file be opened without the passphrase?**
A: No. Without the correct passphrase, the backup file is just encrypted data.

**Q: How is my passphrase stored?**
A: Your passphrase is never stored. It's used only to derive an encryption key when you create or restore a backup.

**Q: What's the file format?**
A: It's a JSON file containing encrypted data with metadata about the backup.

### Troubleshooting

**Q: My backup file seems too small. Is something wrong?**
A: Encrypted data is often compressed. However, if the file is less than 1 KB, it may be corrupted.

**Q: I get an error when creating a backup. What should I do?**
A: Try clearing your browser cache, ensuring you have enough disk space, and trying again. Contact support if the issue persists.

**Q: The restore is taking a long time. Is that normal?**
A: Small to medium datasets restore in under 30 seconds. Larger datasets may take 1-2 minutes. If it takes longer than 5 minutes, refresh and try again.

---

## Getting Help

If you need assistance with backups:

1. **Check This Guide**: Most common questions are answered here
2. **Contact Support**: Email support@gracefulbooks.com
3. **Live Chat**: Available during business hours
4. **Community Forum**: Other users may have experienced similar issues

**Important**: Support cannot recover lost passphrases or decrypt backup files for you. We can only help with the backup/restore process itself.

---

## Summary Checklist

Use this checklist for your backup routine:

- [ ] Created backup with strong passphrase (12+ characters)
- [ ] Wrote down passphrase and stored it securely
- [ ] Saved backup file to secure location
- [ ] Verified backup file downloaded completely
- [ ] Stored backup in at least 2 different locations
- [ ] Added backup creation to my calendar/checklist
- [ ] Tested restore process (at least once)
- [ ] Reviewed this guide and understand the process

---

**Remember**: Your data security is in your hands. Graceful Books provides the tools, but you need to use them regularly and store your backups safely. A backup is only useful if you can find it and decrypt it when you need it!

**Questions?** Contact us at support@gracefulbooks.com
