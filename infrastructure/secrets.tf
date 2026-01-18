# Secrets Management for Graceful Books
# Requirements: H10
# Provider: Cloudflare Workers Secrets + GitHub Secrets

# Note: Secrets cannot be directly managed via Terraform for security reasons
# This file documents the secrets management strategy

# Required GitHub Secrets
# ========================
# Set via: gh secret set SECRET_NAME
# Or via: GitHub UI > Settings > Secrets and variables > Actions

locals {
  required_github_secrets = [
    # Cloudflare
    "CLOUDFLARE_API_TOKEN",      # Cloudflare API token with Workers, Pages, DNS permissions
    "CLOUDFLARE_ACCOUNT_ID",     # Cloudflare account ID

    # Turso Database
    "TURSO_DATABASE_URL",        # Turso database connection URL
    "TURSO_AUTH_TOKEN",          # Turso authentication token

    # Terraform Cloud (optional)
    "TF_API_TOKEN",              # Terraform Cloud API token for remote state

    # Vercel (if using for preview deployments)
    "VERCEL_TOKEN",              # Vercel API token
    "VERCEL_ORG_ID",             # Vercel organization ID
    "VERCEL_PROJECT_ID",         # Vercel project ID

    # Monitoring & Alerts (optional)
    "SENTRY_AUTH_TOKEN",         # Sentry authentication token
    "SENTRY_ORG",                # Sentry organization
    "SENTRY_PROJECT",            # Sentry project
  ]

  required_worker_secrets = [
    # Database
    "TURSO_DATABASE_URL",
    "TURSO_AUTH_TOKEN",

    # SLA Monitoring
    "SLA_ALERT_WEBHOOK",         # Webhook URL for SLA alerts (Slack, Discord, etc.)

    # Optional integrations
    "SENTRY_DSN",                # Sentry DSN for error tracking
  ]
}

# Output secrets documentation
output "secrets_management" {
  description = "Secrets management instructions"
  value = {
    github_secrets = {
      required = local.required_github_secrets
      setup_commands = [
        "# Set GitHub secrets using gh CLI:",
        "gh secret set CLOUDFLARE_API_TOKEN",
        "gh secret set CLOUDFLARE_ACCOUNT_ID",
        "gh secret set TURSO_DATABASE_URL",
        "gh secret set TURSO_AUTH_TOKEN",
        "",
        "# Or via GitHub web UI:",
        "# Go to: Settings > Secrets and variables > Actions > New repository secret"
      ]
    }

    worker_secrets = {
      required = local.required_worker_secrets
      setup_commands = [
        "# Set Cloudflare Worker secrets using wrangler:",
        "cd relay",
        "wrangler secret put TURSO_DATABASE_URL --env production",
        "wrangler secret put TURSO_AUTH_TOKEN --env production",
        "wrangler secret put SLA_ALERT_WEBHOOK --env production",
        "",
        "# For staging:",
        "wrangler secret put TURSO_DATABASE_URL --env staging",
        "wrangler secret put TURSO_AUTH_TOKEN --env staging",
      ]
    }

    environment_variables = {
      description = "Non-secret environment variables (can be set in wrangler.toml)"
      production = {
        ENVIRONMENT              = "production"
        MAX_REQUESTS_PER_MINUTE  = "120"
        MAX_PAYLOAD_SIZE_MB      = "20"
        WS_PING_INTERVAL_MS      = "30000"
        WS_TIMEOUT_MS            = "60000"
        SLA_TARGET_UPTIME        = "0.999"
      }
      staging = {
        ENVIRONMENT              = "staging"
        MAX_REQUESTS_PER_MINUTE  = "60"
        MAX_PAYLOAD_SIZE_MB      = "10"
        WS_PING_INTERVAL_MS      = "30000"
        WS_TIMEOUT_MS            = "60000"
        SLA_TARGET_UPTIME        = "0.99"
      }
    }

    pages_env_vars = {
      description = "Cloudflare Pages environment variables"
      production = {
        NODE_VERSION = "18"
        VITE_APP_ENV = "production"
        VITE_SYNC_RELAY_URL = "https://sync.gracefulbooks.com"
      }
      staging = {
        NODE_VERSION = "18"
        VITE_APP_ENV = "staging"
        VITE_SYNC_RELAY_URL = "https://sync-staging.gracefulbooks.com"
      }
    }

    security_best_practices = [
      "✓ Never commit secrets to version control",
      "✓ Use separate secrets for staging and production",
      "✓ Rotate secrets every 90 days",
      "✓ Use least-privilege access for all tokens",
      "✓ Enable 2FA on all service accounts",
      "✓ Audit secret access regularly",
      "✓ Use secret scanning tools (GitHub secret scanning, git-secrets)",
      "✓ Document secret rotation procedures",
    ]

    secret_rotation = {
      cloudflare_api_token = {
        frequency = "90 days"
        procedure = [
          "1. Create new API token in Cloudflare dashboard",
          "2. Update GitHub secret: gh secret set CLOUDFLARE_API_TOKEN",
          "3. Verify CI/CD pipelines still work",
          "4. Revoke old token in Cloudflare dashboard"
        ]
      }
      turso_auth_token = {
        frequency = "90 days"
        procedure = [
          "1. Create new auth token: turso db tokens create graceful-books-sync",
          "2. Update GitHub secret: gh secret set TURSO_AUTH_TOKEN",
          "3. Update Worker secret: wrangler secret put TURSO_AUTH_TOKEN --env production",
          "4. Verify deployment works",
          "5. Revoke old token: turso db tokens revoke <old-token-id>"
        ]
      }
    }
  }
}

# Secret validation script
# This can be run locally or in CI to verify all required secrets are set
output "secret_validation_script" {
  description = "Script to validate all required secrets are configured"
  value = <<-EOT
    #!/bin/bash
    # Validate GitHub Secrets
    echo "Checking GitHub secrets..."
    REQUIRED_SECRETS=(
      CLOUDFLARE_API_TOKEN
      CLOUDFLARE_ACCOUNT_ID
      TURSO_DATABASE_URL
      TURSO_AUTH_TOKEN
    )

    for secret in "$${REQUIRED_SECRETS[@]}"; do
      if gh secret list | grep -q "$secret"; then
        echo "✓ $secret is set"
      else
        echo "✗ $secret is MISSING"
      fi
    done

    # Validate Worker Secrets
    echo ""
    echo "Checking Worker secrets (production)..."
    cd relay
    WORKER_SECRETS=(
      TURSO_DATABASE_URL
      TURSO_AUTH_TOKEN
      SLA_ALERT_WEBHOOK
    )

    for secret in "$${WORKER_SECRETS[@]}"; do
      if wrangler secret list --env production | grep -q "$secret"; then
        echo "✓ $secret is set"
      else
        echo "✗ $secret is MISSING"
      fi
    done

    echo ""
    echo "Secret validation complete!"
  EOT
}

# Environment variable configuration for wrangler.toml
output "wrangler_env_vars" {
  description = "Environment variables to add to wrangler.toml"
  value = {
    production = {
      ENVIRONMENT              = "production"
      MAX_REQUESTS_PER_MINUTE  = "120"
      MAX_PAYLOAD_SIZE_MB      = "20"
    }
    staging = {
      ENVIRONMENT              = "staging"
      MAX_REQUESTS_PER_MINUTE  = "60"
      MAX_PAYLOAD_SIZE_MB      = "10"
    }
  }
}
