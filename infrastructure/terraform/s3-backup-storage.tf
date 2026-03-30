# ============================================================================
# Audacious Money - S3 Backup Storage Infrastructure
# ============================================================================
#
# Terraform configuration for S3 backup storage per Phase 3, Task 3.2
#
# Resources created:
# - S3 bucket for backup storage
# - KMS key for server-side encryption
# - S3 bucket for access logs
# - IAM role and policy for backend service
# - CloudWatch alarms for monitoring
#
# Usage:
#   terraform init
#   terraform plan -var="environment=dev"
#   terraform apply -var="environment=dev"
#
# ============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment for remote state storage
  # backend "s3" {
  #   bucket = "audacious-money-terraform-state"
  #   key    = "backup-storage/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "AudaciousMoney"
      ManagedBy   = "Terraform"
      Environment = var.environment
      Component   = "BackupStorage"
    }
  }
}

# ============================================================================
# Variables
# ============================================================================

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7

  validation {
    condition     = var.retention_days >= 1 && var.retention_days <= 365
    error_message = "Retention days must be between 1 and 365"
  }
}

variable "enable_versioning" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "enable_kms_encryption" {
  description = "Enable KMS encryption (recommended for production)"
  type        = bool
  default     = true
}

# ============================================================================
# KMS Key for Backup Encryption
# ============================================================================

resource "aws_kms_key" "backup_encryption" {
  count = var.enable_kms_encryption ? 1 : 0

  description             = "Audacious Money Backup Encryption Key (${var.environment})"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "audacious-money-backup-encryption-${var.environment}"
  }
}

resource "aws_kms_alias" "backup_encryption" {
  count = var.enable_kms_encryption ? 1 : 0

  name          = "alias/audacious-money-backup-encryption-${var.environment}"
  target_key_id = aws_kms_key.backup_encryption[0].key_id
}

# ============================================================================
# S3 Bucket for Access Logs
# ============================================================================

resource "aws_s3_bucket" "backup_logs" {
  bucket = "audacious-money-backup-logs-${var.environment}"

  tags = {
    Name = "audacious-money-backup-logs-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "backup_logs" {
  bucket = aws_s3_bucket.backup_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup_logs" {
  bucket = aws_s3_bucket.backup_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backup_logs" {
  bucket = aws_s3_bucket.backup_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backup_logs" {
  bucket = aws_s3_bucket.backup_logs.id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# ============================================================================
# S3 Bucket for Backup Storage
# ============================================================================

resource "aws_s3_bucket" "backup_storage" {
  bucket = "audacious-money-backup-storage-${var.environment}"

  tags = {
    Name = "audacious-money-backup-storage-${var.environment}"
  }
}

# Versioning
resource "aws_s3_bucket_versioning" "backup_storage" {
  bucket = aws_s3_bucket.backup_storage.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_storage" {
  bucket = aws_s3_bucket.backup_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.enable_kms_encryption ? "aws:kms" : "AES256"
      kms_master_key_id = var.enable_kms_encryption ? aws_kms_key.backup_encryption[0].arn : null
    }
    bucket_key_enabled = var.enable_kms_encryption
  }
}

# Public access block
resource "aws_s3_bucket_public_access_block" "backup_storage" {
  bucket = aws_s3_bucket.backup_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Access logging
resource "aws_s3_bucket_logging" "backup_storage" {
  bucket = aws_s3_bucket.backup_storage.id

  target_bucket = aws_s3_bucket.backup_logs.id
  target_prefix = "s3-access-logs/"
}

# Lifecycle policy
resource "aws_s3_bucket_lifecycle_configuration" "backup_storage" {
  bucket = aws_s3_bucket.backup_storage.id

  rule {
    id     = "delete-old-backups"
    status = "Enabled"

    expiration {
      days = var.retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# Bucket policy
resource "aws_s3_bucket_policy" "backup_storage" {
  bucket = aws_s3_bucket.backup_storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnforceSSLOnly"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.backup_storage.arn,
          "${aws_s3_bucket.backup_storage.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid       = "EnforceEncryption"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.backup_storage.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = var.enable_kms_encryption ? "aws:kms" : "AES256"
          }
        }
      }
    ]
  })
}

# ============================================================================
# IAM Role for Backend Service
# ============================================================================

resource "aws_iam_role" "backend_service" {
  name = "audacious-money-backend-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = [
            "ec2.amazonaws.com",
            "ecs-tasks.amazonaws.com",
            "lambda.amazonaws.com"
          ]
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "audacious-money-backend-${var.environment}"
  }
}

resource "aws_iam_role_policy" "backend_s3_access" {
  name = "s3-backup-access"
  role = aws_iam_role.backend_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BackupStorageOperations"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.backup_storage.arn,
          "${aws_s3_bucket.backup_storage.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "backend_kms_access" {
  count = var.enable_kms_encryption ? 1 : 0

  name = "kms-encryption-access"
  role = aws_iam_role.backend_service.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "KMSEncryptionOperations"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.backup_encryption[0].arn
      }
    ]
  })
}

# ============================================================================
# CloudWatch Alarms (Optional)
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "high_storage_usage" {
  count = var.environment == "prod" ? 1 : 0

  alarm_name          = "audacious-money-backup-high-storage-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = 86400 # 24 hours
  statistic           = "Average"
  threshold           = 536870912000 # 500 GB in bytes
  alarm_description   = "S3 backup storage exceeds 500 GB"

  dimensions = {
    BucketName = aws_s3_bucket.backup_storage.id
    StorageType = "StandardStorage"
  }

  tags = {
    Name = "audacious-money-backup-high-storage-${var.environment}"
  }
}

# ============================================================================
# Outputs
# ============================================================================

output "backup_bucket_name" {
  description = "Name of the S3 backup storage bucket"
  value       = aws_s3_bucket.backup_storage.id
}

output "backup_bucket_arn" {
  description = "ARN of the S3 backup storage bucket"
  value       = aws_s3_bucket.backup_storage.arn
}

output "kms_key_id" {
  description = "ID of the KMS encryption key"
  value       = var.enable_kms_encryption ? aws_kms_key.backup_encryption[0].id : null
}

output "kms_key_arn" {
  description = "ARN of the KMS encryption key"
  value       = var.enable_kms_encryption ? aws_kms_key.backup_encryption[0].arn : null
}

output "backend_role_arn" {
  description = "ARN of the IAM role for backend service"
  value       = aws_iam_role.backend_service.arn
}

output "region" {
  description = "AWS region"
  value       = var.aws_region
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

# ============================================================================
# Usage Instructions
# ============================================================================

# To deploy:
#   terraform init
#   terraform plan -var="environment=dev"
#   terraform apply -var="environment=dev"
#
# To destroy:
#   terraform destroy -var="environment=dev"
#
# ============================================================================
