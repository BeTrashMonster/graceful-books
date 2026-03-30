# S3 Backup Storage Setup Guide

**Purpose:** Configure AWS S3 bucket for temporary encrypted backup storage per ROADMAP_BACKUP_AND_SYNC.md Phase 3, Task 3.2.

**Security Level:** Defense in depth (client-side encryption + server-side encryption)

---

## Overview

The email backup system temporarily stores encrypted backups in S3 for restoration via email links. Backups are:
- **Client-side encrypted** (AES-256-GCM) before upload
- **Server-side encrypted** (AES-256 + KMS) in S3
- **Auto-deleted** after 7 days (lifecycle policy)
- **Access-controlled** (private bucket, no public access)
- **Access-logged** for security auditing

---

## S3 Bucket Configuration

### Required Settings

**Bucket Name:** `audacious-money-backup-storage-[environment]`
- Production: `audacious-money-backup-storage-prod`
- Staging: `audacious-money-backup-storage-staging`
- Development: `audacious-money-backup-storage-dev`

**Region:** `us-east-1` (or your preferred region)

**Encryption:**
- Server-side encryption: `AES-256`
- AWS KMS: Enabled with customer-managed key (CMK)
- Default encryption: Enforced (reject unencrypted uploads)

**Versioning:** Enabled (protects against accidental deletion)

**Lifecycle Policy:**
- Delete objects after 7 days
- Delete non-current versions after 1 day
- Abort incomplete multipart uploads after 1 day

**Public Access:**
- Block all public access: `ENABLED`
- Block public ACLs: `ENABLED`
- Ignore public ACLs: `ENABLED`
- Block public bucket policies: `ENABLED`
- Restrict public buckets: `ENABLED`

**Access Logging:**
- Enabled: `YES`
- Target bucket: `audacious-money-backup-logs-[environment]`
- Prefix: `s3-access-logs/`

**Object Lock:** `DISABLED` (not needed, lifecycle handles cleanup)

**Transfer Acceleration:** `DISABLED` (cost optimization)

**Requester Pays:** `DISABLED`

---

## IAM Policy (Backend Service)

The backend service needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BackupStorageUpload",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::audacious-money-backup-storage-prod/*"
    },
    {
      "Sid": "BackupStorageRetrieve",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::audacious-money-backup-storage-prod/*"
    },
    {
      "Sid": "BackupStorageDelete",
      "Effect": "Allow",
      "Action": [
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::audacious-money-backup-storage-prod/*"
    },
    {
      "Sid": "BackupStorageList",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::audacious-money-backup-storage-prod"
    },
    {
      "Sid": "KMSEncryption",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KMS_KEY_ID"
    }
  ]
}
```

---

## KMS Key Configuration

**Key Type:** Customer managed key (CMK)

**Key Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Enable IAM User Permissions",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT_ID:root"
      },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "Allow Backend Service",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT_ID:role/audacious-money-backend-role"
      },
      "Action": [
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "*"
    }
  ]
}
```

**Key Rotation:** Enabled (automatic annual rotation)

**Key Alias:** `alias/audacious-money-backup-encryption`

---

## Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnforceSSLOnly",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::audacious-money-backup-storage-prod",
        "arn:aws:s3:::audacious-money-backup-storage-prod/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    },
    {
      "Sid": "EnforceEncryption",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::audacious-money-backup-storage-prod/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "aws:kms"
        }
      }
    }
  ]
}
```

---

## CORS Configuration

**Not Required** - Backend service uploads directly, not browser-based uploads.

If needed for pre-signed URLs:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["https://app.audaciousmoney.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## Lifecycle Policy (JSON)

```json
{
  "Rules": [
    {
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "Expiration": {
        "Days": 7
      },
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 1
      },
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 1
      }
    }
  ]
}
```

---

## Environment Variables

Add to backend service `.env`:

```bash
# S3 Backup Storage Configuration
AWS_REGION=us-east-1
AWS_S3_BACKUP_BUCKET=audacious-money-backup-storage-prod
AWS_S3_BACKUP_KMS_KEY_ID=arn:aws:kms:us-east-1:ACCOUNT_ID:key/KMS_KEY_ID

# AWS Credentials (use IAM role in production)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Backup Storage Settings
BACKUP_RETENTION_DAYS=7
BACKUP_MAX_SIZE_MB=100
```

---

## Cost Estimation

**Assumptions:**
- 1000 active users
- Average backup size: 10 MB
- Backups generated weekly
- Storage duration: 7 days average

**Monthly Costs (us-east-1):**

| Service | Usage | Cost |
|---------|-------|------|
| S3 Storage (Standard) | ~250 GB-days (avg) | $5.75 |
| S3 PUT requests | 4000/month | $0.02 |
| S3 GET requests | 1000/month | $0.004 |
| S3 DELETE requests | 4000/month | $0 (free) |
| KMS Requests | 10,000/month | $0.03 |
| Data Transfer OUT | 10 GB/month | $0.90 |
| **TOTAL** | | **~$6.71/month** |

**Cost at scale (10,000 users):** ~$67/month

---

## Monitoring & Alerts

### CloudWatch Alarms

1. **High Storage Usage**
   - Metric: `BucketSizeBytes`
   - Threshold: > 500 GB
   - Action: SNS notification to ops team

2. **Failed Uploads**
   - Metric: `4xxErrors`
   - Threshold: > 10 per hour
   - Action: SNS notification + PagerDuty

3. **Unauthorized Access Attempts**
   - Metric: `AllRequests` with 403 status
   - Threshold: > 5 per hour
   - Action: SNS notification (security alert)

4. **High Egress Costs**
   - Metric: `BytesDownloaded`
   - Threshold: > 100 GB per day
   - Action: SNS notification (cost alert)

### Access Logging Analysis

Enable S3 access logging and analyze with AWS Athena:
```sql
-- Query to find suspicious access patterns
SELECT
  bucket_name,
  remote_ip,
  requester,
  COUNT(*) as request_count,
  SUM(bytes_sent) as total_bytes
FROM s3_access_logs
WHERE
  request_date >= CURRENT_DATE - INTERVAL '1' DAY
  AND http_status = '403'
GROUP BY bucket_name, remote_ip, requester
ORDER BY request_count DESC
LIMIT 50;
```

---

## Security Best Practices

### ✅ DO
- Use IAM roles for EC2/Lambda (not access keys)
- Enable MFA for bucket deletion
- Regularly rotate KMS keys
- Monitor access logs for anomalies
- Use VPC endpoints for S3 access (cost + security)
- Enable CloudTrail for API audit logs
- Tag all resources for cost allocation
- Test restore process regularly
- Set up budget alerts

### ❌ DON'T
- Store AWS credentials in code
- Disable encryption
- Make bucket public
- Skip access logging
- Store backups indefinitely (cost)
- Use root account for API access
- Share IAM credentials across services

---

## Testing Checklist

Before production deployment:

- [ ] Bucket created with correct name
- [ ] Default encryption enabled (AES-256 + KMS)
- [ ] Lifecycle policy configured (7-day deletion)
- [ ] Public access blocked (all 4 settings)
- [ ] Access logging enabled
- [ ] Versioning enabled
- [ ] Bucket policy enforces SSL
- [ ] Bucket policy enforces encryption
- [ ] IAM role created for backend service
- [ ] IAM policy attached with correct permissions
- [ ] KMS key created and configured
- [ ] KMS key alias created
- [ ] Environment variables set
- [ ] Test upload works
- [ ] Test download works
- [ ] Test deletion works
- [ ] Test lifecycle deletion (wait 7 days or simulate)
- [ ] CloudWatch alarms configured
- [ ] Access logs viewable in target bucket
- [ ] Budget alerts configured

---

## Terraform Configuration (Optional)

See `infrastructure/terraform/s3-backup-storage.tf` for infrastructure-as-code setup.

---

## Troubleshooting

### Upload Fails with "Access Denied"
- Check IAM policy has `s3:PutObject` permission
- Verify KMS key policy allows backend role
- Ensure bucket policy doesn't deny the action

### Download Fails with "NoSuchKey"
- Verify object hasn't been deleted by lifecycle policy
- Check object key is correct
- Ensure IAM policy has `s3:GetObject` permission

### High Costs
- Check for failed lifecycle policy (objects not deleting)
- Monitor egress (data transfer out)
- Look for unauthorized access (abuse)
- Consider using S3 Intelligent-Tiering

### Encryption Errors
- Verify KMS key is enabled
- Check KMS key policy allows backend role
- Ensure default encryption is enabled on bucket

---

## Production Deployment Steps

1. **Create KMS Key**
   ```bash
   aws kms create-key --description "Audacious Money Backup Encryption"
   aws kms create-alias --alias-name alias/audacious-money-backup-encryption --target-key-id [KEY_ID]
   ```

2. **Create S3 Bucket**
   ```bash
   aws s3api create-bucket \
     --bucket audacious-money-backup-storage-prod \
     --region us-east-1
   ```

3. **Enable Versioning**
   ```bash
   aws s3api put-bucket-versioning \
     --bucket audacious-money-backup-storage-prod \
     --versioning-configuration Status=Enabled
   ```

4. **Enable Default Encryption**
   ```bash
   aws s3api put-bucket-encryption \
     --bucket audacious-money-backup-storage-prod \
     --server-side-encryption-configuration '{
       "Rules": [{
         "ApplyServerSideEncryptionByDefault": {
           "SSEAlgorithm": "aws:kms",
           "KMSMasterKeyID": "[KMS_KEY_ID]"
         },
         "BucketKeyEnabled": true
       }]
     }'
   ```

5. **Block Public Access**
   ```bash
   aws s3api put-public-access-block \
     --bucket audacious-money-backup-storage-prod \
     --public-access-block-configuration \
       BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   ```

6. **Apply Lifecycle Policy**
   ```bash
   aws s3api put-bucket-lifecycle-configuration \
     --bucket audacious-money-backup-storage-prod \
     --lifecycle-configuration file://lifecycle-policy.json
   ```

7. **Enable Access Logging**
   ```bash
   aws s3api put-bucket-logging \
     --bucket audacious-money-backup-storage-prod \
     --bucket-logging-status '{
       "LoggingEnabled": {
         "TargetBucket": "audacious-money-backup-logs-prod",
         "TargetPrefix": "s3-access-logs/"
       }
     }'
   ```

8. **Apply Bucket Policy**
   ```bash
   aws s3api put-bucket-policy \
     --bucket audacious-money-backup-storage-prod \
     --policy file://bucket-policy.json
   ```

---

## Maintenance Schedule

### Daily
- Monitor CloudWatch alarms
- Check for security alerts

### Weekly
- Review access logs for anomalies
- Check bucket storage size trends

### Monthly
- Review and optimize costs
- Test restore process
- Update IAM policies if needed
- Review CloudTrail logs for API activity

### Quarterly
- Audit bucket permissions
- Review lifecycle policy effectiveness
- Test disaster recovery scenarios
- Update documentation

---

## Support & Resources

- AWS S3 Documentation: https://docs.aws.amazon.com/s3/
- AWS KMS Documentation: https://docs.aws.amazon.com/kms/
- S3 Security Best Practices: https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html
- Internal: Contact DevOps team for bucket access

---

**Document Version:** 1.0
**Last Updated:** 2026-03-30
**Maintained By:** DevOps & Security Team
**Review Cycle:** Quarterly
