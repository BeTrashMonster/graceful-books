# Database Infrastructure for Graceful Books
# Requirements: H10, ARCH-003
# Provider: Turso (LibSQL)

# Note: Turso database provisioning is handled via Turso CLI
# This file documents the infrastructure requirements

# Turso Database Configuration (via CLI)
# ----------------------------------------
# Primary database: graceful-books-sync
# Replicas: us-east, eu-west, ap-southeast
#
# Creation commands:
# turso db create graceful-books-sync --location iad
# turso db replicate graceful-books-sync --location lhr
# turso db replicate graceful-books-sync --location sin
#
# Get credentials:
# turso db show graceful-books-sync --url
# turso db tokens create graceful-books-sync

# D1 Database (Alternative - Cloudflare native)
# Note: D1 Terraform support is experimental
# Create via wrangler CLI: wrangler d1 create graceful-books-sync

# Database Backup Configuration
resource "cloudflare_r2_bucket" "database_backups" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  name       = "graceful-books-db-backups"
  location   = "WNAM"
}

# Backup lifecycle policy (conceptual - R2 lifecycle via API)
# Policy: Retain daily backups for 30 days, weekly for 90 days, monthly for 1 year

# Database Migration Tracking
# Migrations tracked in repository: relay/migrations/
# Applied via wrangler or custom migration script

# Database Monitoring
# - Connection health checks via /health endpoint
# - Query performance monitoring via Turso dashboard
# - Backup verification via automated tests

# Environment Variables (set via Wrangler secrets)
# TURSO_DATABASE_URL - Database connection URL
# TURSO_AUTH_TOKEN - Authentication token

# Database Regions
# Primary: US East (iad)
# Replica: EU West (lhr)
# Replica: AP Southeast (sin)

locals {
  database_config = {
    provider = "turso" # or "d1" for Cloudflare D1
    regions = [
      {
        name     = "us-east"
        location = "iad"
        primary  = true
      },
      {
        name     = "eu-west"
        location = "lhr"
        primary  = false
      },
      {
        name     = "ap-southeast"
        location = "sin"
        primary  = false
      }
    ]
    backup_schedule   = "0 2 * * *" # Daily at 2 AM UTC
    backup_retention  = var.r2_backup_retention_days
    connection_pool   = 5
    max_connections   = 100
    statement_timeout = "30s"
  }
}

# Output database configuration
output "database_config" {
  description = "Database configuration and setup instructions"
  value = {
    provider          = local.database_config.provider
    regions           = local.database_config.regions
    backup_schedule   = local.database_config.backup_schedule
    backup_retention  = local.database_config.backup_retention
    backup_bucket     = cloudflare_r2_bucket.database_backups.name
    setup_instructions = <<-EOT
      # Turso Database Setup

      1. Install Turso CLI:
         curl -sSfL https://get.tur.so/install.sh | bash

      2. Login to Turso:
         turso auth login

      3. Create database:
         turso db create graceful-books-sync --location iad

      4. Create replicas:
         turso db replicate graceful-books-sync --location lhr
         turso db replicate graceful-books-sync --location sin

      5. Get connection details:
         turso db show graceful-books-sync --url

      6. Create auth token:
         turso db tokens create graceful-books-sync

      7. Set secrets in GitHub:
         gh secret set TURSO_DATABASE_URL
         gh secret set TURSO_AUTH_TOKEN

      8. Set secrets in Wrangler:
         wrangler secret put TURSO_DATABASE_URL --env production
         wrangler secret put TURSO_AUTH_TOKEN --env production

      # Database Backups

      Automated backups run daily at 2 AM UTC.
      Backups stored in: ${cloudflare_r2_bucket.database_backups.name}
      Retention: ${local.database_config.backup_retention} days

      # Migration Management

      Apply migrations:
         cd relay && npm run db:migrate

      Check migration status:
         cd relay && npm run db:status
    EOT
  }
}

# Backup automation script (to be deployed as Cloudflare Worker cron)
# See: scripts/db-backup-worker.ts
