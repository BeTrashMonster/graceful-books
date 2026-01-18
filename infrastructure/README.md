# Graceful Books Infrastructure

**Build:** H10 - Production Infrastructure [MVP]
**Requirements:** ARCH-003, H8, E8
**Status:** ✅ Complete

## Overview

This directory contains Infrastructure as Code (IaC) for Graceful Books using Terraform and the Cloudflare provider.

## Architecture

- **Frontend:** Cloudflare Pages (React + Vite)
- **Backend:** Cloudflare Workers (Sync Relay)
- **Database:** Turso (LibSQL, multi-region)
- **Storage:** Cloudflare R2 (Assets, Backups)
- **CDN:** Cloudflare Global Edge Network
- **DNS:** Cloudflare DNS
- **Security:** Cloudflare WAF, DDoS Protection

## Quick Start

### Prerequisites

1. **Cloudflare Account**
   - Sign up at https://cloudflare.com
   - Get API token: Dashboard > My Profile > API Tokens > Create Token
   - Get Account ID: Dashboard > Overview > Account ID

2. **Turso Account**
   - Sign up at https://turso.tech
   - Install CLI: `curl -sSfL https://get.tur.so/install.sh | bash`

3. **Required Tools**
   ```bash
   # Terraform
   brew install terraform  # macOS
   choco install terraform  # Windows

   # Wrangler CLI
   npm install -g wrangler

   # GitHub CLI (optional)
   brew install gh  # macOS
   choco install gh  # Windows
   ```

### Initial Setup

1. **Clone repository:**
   ```bash
   git clone https://github.com/gracefulbooks/graceful-books.git
   cd graceful-books/infrastructure
   ```

2. **Configure Terraform variables:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

3. **Set environment variables:**
   ```bash
   export CLOUDFLARE_API_TOKEN="your-cloudflare-token"
   export TURSO_DATABASE_URL="libsql://your-db.turso.io"
   export TURSO_AUTH_TOKEN="your-turso-token"
   ```

4. **Initialize Terraform:**
   ```bash
   terraform init
   ```

5. **Plan infrastructure:**
   ```bash
   terraform plan -var-file=terraform.tfvars
   ```

6. **Apply infrastructure:**
   ```bash
   terraform apply -var-file=terraform.tfvars
   ```

## Files

| File | Purpose |
|------|---------|
| `main.tf` | Core infrastructure resources (Pages, Workers, DNS, R2, KV) |
| `variables.tf` | Input variables and validation |
| `outputs.tf` | Output values and next steps |
| `database.tf` | Database configuration and setup instructions |
| `secrets.tf` | Secrets management documentation |
| `terraform.tfvars.example` | Example configuration |
| `.gitignore` | Exclude secrets from version control |
| `tests/` | Infrastructure validation tests |

## Terraform Commands

```bash
# Validate configuration
terraform validate

# Format code
terraform fmt

# Plan changes (staging)
terraform plan -var-file=staging.tfvars

# Plan changes (production)
terraform plan -var-file=production.tfvars

# Apply changes (with confirmation)
terraform apply -var-file=production.tfvars

# Apply changes (auto-approve, use with caution!)
terraform apply -var-file=production.tfvars -auto-approve

# View outputs
terraform output

# Show current state
terraform show

# Destroy infrastructure (DANGER!)
terraform destroy -var-file=production.tfvars
```

## Environments

### Staging
- **URL:** https://staging.gracefulbooks.pages.dev
- **Workers:** https://sync-staging.gracefulbooks.com
- **Config:** `staging.tfvars`

### Production
- **URL:** https://gracefulbooks.com
- **Workers:** https://sync.gracefulbooks.com
- **Config:** `production.tfvars`

## Secrets Management

### GitHub Secrets (for CI/CD)

```bash
# Set via GitHub CLI
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set TURSO_DATABASE_URL
gh secret set TURSO_AUTH_TOKEN

# Or via GitHub web UI:
# Settings > Secrets and variables > Actions > New repository secret
```

### Cloudflare Worker Secrets

```bash
cd ../relay

# Production
wrangler secret put TURSO_DATABASE_URL --env production
wrangler secret put TURSO_AUTH_TOKEN --env production
wrangler secret put SLA_ALERT_WEBHOOK --env production

# Staging
wrangler secret put TURSO_DATABASE_URL --env staging
wrangler secret put TURSO_AUTH_TOKEN --env staging
```

## Database Setup

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Create database
turso db create graceful-books-sync --location iad

# Create replicas
turso db replicate graceful-books-sync --location lhr
turso db replicate graceful-books-sync --location sin

# Get connection details
turso db show graceful-books-sync --url

# Create auth token
turso db tokens create graceful-books-sync

# Save these values in secrets!
```

## Deployment

### Via GitHub Actions (Recommended)

1. **Push to main:** Automatically deploys to staging
2. **Create release:** Manually approve production deployment

### Via CLI

```bash
# Deploy infrastructure
terraform apply -var-file=production.tfvars

# Deploy Workers
cd ../relay
wrangler deploy --env production

# Deploy Pages
cd ..
npm run build
npx wrangler pages deploy dist --project-name=graceful-books --branch=main
```

## Health Checks

```bash
# Check all regions
for region in us eu ap; do
  echo "=== sync-$region ==="
  curl https://sync-$region.gracefulbooks.com/health | jq
done

# Check global endpoint
curl https://sync.gracefulbooks.com/health | jq

# Check Pages
curl https://gracefulbooks.com
```

## Rollback

```bash
# Automated rollback
../scripts/rollback.sh workers production
../scripts/rollback.sh pages production

# Manual rollback
cd ../relay
wrangler deployments list --env production
wrangler rollback --env production --version-id <version-id>
```

## Monitoring

### Cloudflare Dashboard
- Workers: https://dash.cloudflare.com > Workers > graceful-books-sync-relay
- Pages: https://dash.cloudflare.com > Pages > graceful-books
- Analytics: View requests, errors, performance

### Endpoints
- Health: `https://sync.gracefulbooks.com/health`
- SLA Metrics: `https://sync.gracefulbooks.com/metrics/sla`

### Logs
```bash
# Real-time logs
cd ../relay
wrangler tail --env production

# Filter errors only
wrangler tail --env production --format=json | jq 'select(.level == "error")'
```

## Costs

Estimated monthly costs:

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Cloudflare Pro | Pro | $20 |
| Cloudflare Workers | Paid | $5 |
| Turso Database | Scaler | $29 |
| **Total** | | **~$54** |

## Troubleshooting

### Issue: Terraform fails with "zone not found"

**Solution:**
```bash
# If zone doesn't exist, create it first
# Set create_zone = true in terraform.tfvars
terraform apply -var="create_zone=true"
```

### Issue: Worker deployment fails

**Solution:**
```bash
# Check authentication
wrangler whoami

# Re-authenticate
wrangler login

# Verify secrets are set
wrangler secret list --env production
```

### Issue: Database connection fails

**Solution:**
```bash
# Test database connection
turso db shell graceful-books-sync --execute "SELECT 1"

# Verify secrets in Worker
wrangler secret list --env production

# Check if TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set
```

## Security

- ✅ All secrets stored securely (GitHub Secrets, Wrangler Secrets)
- ✅ TLS 1.3 enforced
- ✅ HSTS enabled with 1-year max-age
- ✅ WAF rules configured
- ✅ Rate limiting enabled
- ✅ DDoS protection active
- ✅ No secrets in version control (`.gitignore`)

## Testing

```bash
# Run infrastructure tests
cd tests
npm install
npm test

# Run integration tests (requires deployed infrastructure)
RUN_INTEGRATION_TESTS=true npm test
```

## Documentation

- **Full Infrastructure Guide:** [../docs/INFRASTRUCTURE.md](../docs/INFRASTRUCTURE.md)
- **Deployment Runbook:** [../docs/DEPLOYMENT_RUNBOOK.md](../docs/DEPLOYMENT_RUNBOOK.md)
- **Cloudflare Docs:** https://developers.cloudflare.com
- **Turso Docs:** https://docs.turso.tech
- **Terraform Cloudflare Provider:** https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs

## Support

- **Issues:** https://github.com/gracefulbooks/graceful-books/issues
- **Discussions:** https://github.com/gracefulbooks/graceful-books/discussions
- **Slack:** #infrastructure (internal)

## Next Steps

After deploying infrastructure:

1. ✅ Set up GitHub secrets
2. ✅ Configure Worker secrets
3. ✅ Create Turso database
4. ✅ Deploy to staging and verify
5. ✅ Set up monitoring alerts
6. ✅ Test rollback procedures
7. ✅ Deploy to production
8. ✅ Monitor for 24 hours
9. ✅ Document any issues

## License

See [LICENSE](../LICENSE) in root directory.

---

**Maintained by:** DevOps Team
**Last Updated:** 2026-01-18
**Version:** 1.0.0
