# Outputs for Graceful Books Infrastructure
# Requirements: H10

# Zone Information
output "zone_id" {
  description = "Cloudflare Zone ID"
  value       = local.zone_id
}

output "zone_name" {
  description = "Domain name"
  value       = var.domain_name
}

output "zone_name_servers" {
  description = "Cloudflare name servers for the zone"
  value       = var.create_zone ? cloudflare_zone.main[0].name_servers : null
}

# Cloudflare Pages
output "pages_project_name" {
  description = "Cloudflare Pages project name"
  value       = cloudflare_pages_project.main.name
}

output "pages_project_id" {
  description = "Cloudflare Pages project ID"
  value       = cloudflare_pages_project.main.id
}

output "pages_subdomain" {
  description = "Cloudflare Pages subdomain"
  value       = cloudflare_pages_project.main.subdomain
}

output "app_url" {
  description = "Main application URL"
  value       = "https://${var.domain_name}"
}

output "app_url_www" {
  description = "WWW application URL"
  value       = "https://www.${var.domain_name}"
}

# R2 Buckets
output "r2_assets_bucket_name" {
  description = "R2 assets bucket name"
  value       = cloudflare_r2_bucket.assets.name
}

output "r2_backups_bucket_name" {
  description = "R2 backups bucket name"
  value       = cloudflare_r2_bucket.backups.name
}

output "r2_assets_bucket_id" {
  description = "R2 assets bucket ID"
  value       = cloudflare_r2_bucket.assets.id
}

output "r2_backups_bucket_id" {
  description = "R2 backups bucket ID"
  value       = cloudflare_r2_bucket.backups.id
}

# KV Namespaces
output "kv_rate_limit_id" {
  description = "KV namespace ID for rate limiting"
  value       = cloudflare_workers_kv_namespace.rate_limit.id
}

output "kv_rate_limit_preview_id" {
  description = "KV namespace ID for rate limiting (preview)"
  value       = cloudflare_workers_kv_namespace.rate_limit_preview.id
}

output "kv_session_cache_id" {
  description = "KV namespace ID for session caching"
  value       = cloudflare_workers_kv_namespace.session_cache.id
}

# Sync Relay Endpoints
output "sync_relay_urls" {
  description = "Sync relay endpoint URLs"
  value = {
    global  = "https://sync.${var.domain_name}"
    us      = "https://sync-us.${var.domain_name}"
    eu      = "https://sync-eu.${var.domain_name}"
    ap      = "https://sync-ap.${var.domain_name}"
    staging = "https://sync-staging.${var.domain_name}"
  }
}

# Load Balancer
output "load_balancer_id" {
  description = "Cloudflare Load Balancer ID"
  value       = var.enable_load_balancer ? cloudflare_load_balancer.sync.id : null
}

output "load_balancer_pools" {
  description = "Load Balancer pool IDs"
  value = var.enable_load_balancer ? {
    us = cloudflare_load_balancer_pool.sync_us.id
    eu = cloudflare_load_balancer_pool.sync_eu.id
    ap = cloudflare_load_balancer_pool.sync_ap.id
  } : null
}

# Security
output "ssl_mode" {
  description = "SSL/TLS encryption mode"
  value       = "strict"
}

output "min_tls_version" {
  description = "Minimum TLS version"
  value       = var.min_tls_version
}

# Health Check URLs
output "health_check_urls" {
  description = "Health check endpoints for verification"
  value = {
    sync_us = "https://sync-us.${var.domain_name}/health"
    sync_eu = "https://sync-eu.${var.domain_name}/health"
    sync_ap = "https://sync-ap.${var.domain_name}/health"
  }
}

# DNS Records
output "dns_records" {
  description = "Configured DNS records"
  value = {
    root         = cloudflare_record.root.hostname
    www          = cloudflare_record.www.hostname
    sync         = cloudflare_record.sync.hostname
    sync_us      = cloudflare_record.sync_us.hostname
    sync_eu      = cloudflare_record.sync_eu.hostname
    sync_ap      = cloudflare_record.sync_ap.hostname
    sync_staging = cloudflare_record.sync_staging.hostname
  }
}

# Account Information
output "account_id" {
  description = "Cloudflare Account ID"
  value       = data.cloudflare_accounts.main.accounts[0].id
  sensitive   = true
}

# Deployment Information
output "deployment_info" {
  description = "Deployment configuration summary"
  value = {
    environment       = var.environment
    cloudflare_plan   = var.cloudflare_plan
    node_version      = var.node_version
    enable_argo       = var.enable_argo
    enable_waf        = var.enable_waf
    regions           = var.sync_relay_regions
    backup_retention  = var.r2_backup_retention_days
  }
}

# Next Steps
output "next_steps" {
  description = "Post-deployment configuration steps"
  value = <<-EOT
    ✓ Infrastructure provisioned successfully!

    Next steps:
    1. Configure GitHub secrets for CI/CD:
       - CLOUDFLARE_API_TOKEN
       - CLOUDFLARE_ACCOUNT_ID
       - TURSO_AUTH_TOKEN
       - TURSO_DATABASE_URL

    2. Deploy Cloudflare Workers:
       cd relay && wrangler deploy --env production

    3. Configure KV namespace IDs in wrangler.toml:
       - RATE_LIMIT: ${cloudflare_workers_kv_namespace.rate_limit.id}
       - RATE_LIMIT_PREVIEW: ${cloudflare_workers_kv_namespace.rate_limit_preview.id}

    4. Set up monitoring:
       - Configure Cloudflare Analytics
       - Set up external uptime monitoring
       - Configure alert webhooks

    5. Test deployments:
       - Trigger staging deploy: git push origin main
       - Trigger production deploy: Create GitHub release

    6. Verify health checks:
       ${join("\n       ", [for k, v in {
         sync_us = "https://sync-us.${var.domain_name}/health"
         sync_eu = "https://sync-eu.${var.domain_name}/health"
         sync_ap = "https://sync-ap.${var.domain_name}/health"
       } : "curl ${v}"])}

    Application URLs:
    - Production: https://${var.domain_name}
    - WWW: https://www.${var.domain_name}
    - Sync (Global): https://sync.${var.domain_name}

    Documentation: ./docs/INFRASTRUCTURE.md
  EOT
}
