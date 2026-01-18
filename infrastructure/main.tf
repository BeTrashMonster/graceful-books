# Graceful Books - Production Infrastructure
# Requirements: H10, ARCH-003
# Provider: Cloudflare-first architecture

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  # Remote state backend (configure for production)
  backend "local" {
    path = "terraform.tfstate"
  }

  # For production, use remote backend:
  # backend "s3" {
  #   bucket = "graceful-books-terraform-state"
  #   key    = "infrastructure/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "cloudflare" {
  # API token should be set via environment variable:
  # export CLOUDFLARE_API_TOKEN="your-api-token"
  # Or use Terraform Cloud/GitHub Secrets
}

# Data source for account ID
data "cloudflare_accounts" "main" {
  name = var.cloudflare_account_name
}

# Zone (Domain) Configuration
resource "cloudflare_zone" "main" {
  count      = var.create_zone ? 1 : 0
  account_id = data.cloudflare_accounts.main.accounts[0].id
  zone       = var.domain_name
  plan       = var.cloudflare_plan

  # Security settings
  type = "full"
}

# Or reference existing zone
data "cloudflare_zone" "main" {
  count = var.create_zone ? 0 : 1
  name  = var.domain_name
}

locals {
  zone_id = var.create_zone ? cloudflare_zone.main[0].id : data.cloudflare_zone.main[0].id
}

# SSL/TLS Settings
resource "cloudflare_zone_settings_override" "main" {
  zone_id = local.zone_id

  settings {
    # Force HTTPS
    ssl = "strict"
    always_use_https = "on"
    min_tls_version = "1.3"
    tls_1_3 = "on"

    # Security headers
    security_header {
      enabled = true
      max_age = 31536000
      include_subdomains = true
      preload = true
      nosniff = true
    }

    # Performance
    http2 = "on"
    http3 = "on"
    zero_rtt = "on"
    brotli = "on"
    early_hints = "on"

    # Caching
    browser_cache_ttl = 14400
    cache_level = "aggressive"

    # DDoS Protection
    challenge_ttl = 1800
    browser_check = "on"

    # WebSockets
    websockets = "on"
  }
}

# DNS Records
resource "cloudflare_record" "root" {
  zone_id = local.zone_id
  name    = "@"
  value   = "graceful-books.pages.dev"
  type    = "CNAME"
  proxied = true
  comment = "Main application - Cloudflare Pages"
}

resource "cloudflare_record" "www" {
  zone_id = local.zone_id
  name    = "www"
  value   = var.domain_name
  type    = "CNAME"
  proxied = true
  comment = "WWW redirect to root"
}

resource "cloudflare_record" "sync_us" {
  zone_id = local.zone_id
  name    = "sync-us"
  value   = "graceful-books-sync-relay.workers.dev"
  type    = "CNAME"
  proxied = true
  comment = "Sync relay - US region"
}

resource "cloudflare_record" "sync_eu" {
  zone_id = local.zone_id
  name    = "sync-eu"
  value   = "graceful-books-sync-relay.workers.dev"
  type    = "CNAME"
  proxied = true
  comment = "Sync relay - EU region"
}

resource "cloudflare_record" "sync_ap" {
  zone_id = local.zone_id
  name    = "sync-ap"
  value   = "graceful-books-sync-relay.workers.dev"
  type    = "CNAME"
  proxied = true
  comment = "Sync relay - AP region"
}

resource "cloudflare_record" "sync" {
  zone_id = local.zone_id
  name    = "sync"
  value   = "graceful-books-sync-relay.workers.dev"
  type    = "CNAME"
  proxied = true
  comment = "Sync relay - global endpoint"
}

resource "cloudflare_record" "sync_staging" {
  zone_id = local.zone_id
  name    = "sync-staging"
  value   = "graceful-books-sync-relay-staging.workers.dev"
  type    = "CNAME"
  proxied = true
  comment = "Sync relay - staging environment"
}

# Cloudflare Pages Project
resource "cloudflare_pages_project" "main" {
  account_id        = data.cloudflare_accounts.main.accounts[0].id
  name              = "graceful-books"
  production_branch = "main"

  build_config {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = "/"
  }

  source {
    type = "github"
    config {
      owner                         = var.github_org
      repo_name                     = var.github_repo
      production_branch             = "main"
      pr_comments_enabled           = true
      deployments_enabled           = true
      production_deployment_enabled = true
      preview_deployment_setting    = "custom"
      preview_branch_includes       = ["staging", "preview/*"]
      preview_branch_excludes       = ["dependabot/*"]
    }
  }

  deployment_configs {
    production {
      environment_variables = {
        NODE_VERSION = var.node_version
        VITE_APP_ENV = "production"
      }

      # Secrets managed via Cloudflare Dashboard or API
      # Cannot be set in Terraform for security
    }

    preview {
      environment_variables = {
        NODE_VERSION = var.node_version
        VITE_APP_ENV = "staging"
      }
    }
  }
}

# Custom domain for Pages
resource "cloudflare_pages_domain" "main" {
  account_id   = data.cloudflare_accounts.main.accounts[0].id
  project_name = cloudflare_pages_project.main.name
  domain       = var.domain_name
}

resource "cloudflare_pages_domain" "www" {
  account_id   = data.cloudflare_accounts.main.accounts[0].id
  project_name = cloudflare_pages_project.main.name
  domain       = "www.${var.domain_name}"
}

# R2 Bucket for static assets and backups
resource "cloudflare_r2_bucket" "assets" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  name       = "graceful-books-assets"
  location   = "WNAM" # Western North America
}

resource "cloudflare_r2_bucket" "backups" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  name       = "graceful-books-backups"
  location   = "WNAM"
}

# KV Namespaces for Workers
resource "cloudflare_workers_kv_namespace" "rate_limit" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  title      = "graceful-books-rate-limit"
}

resource "cloudflare_workers_kv_namespace" "rate_limit_preview" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  title      = "graceful-books-rate-limit-preview"
}

resource "cloudflare_workers_kv_namespace" "session_cache" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  title      = "graceful-books-session-cache"
}

# D1 Database (managed via wrangler CLI or API)
# Note: D1 Terraform support is limited, use wrangler for actual provisioning
# This is a placeholder for future Terraform support

# Web Application Firewall (WAF) Rules
resource "cloudflare_ruleset" "zone_custom_firewall" {
  zone_id     = local.zone_id
  name        = "Graceful Books Security Rules"
  description = "Custom security rules for Graceful Books"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    action = "block"
    expression = "(http.request.uri.path contains \"/admin\" and not ip.src in $trusted_ips)"
    description = "Block admin access from untrusted IPs"
    enabled = true
  }

  rules {
    action = "challenge"
    expression = "(cf.threat_score gt 14)"
    description = "Challenge suspicious traffic"
    enabled = true
  }

  rules {
    action = "block"
    expression = "(http.request.method eq \"POST\" and http.request.uri.path contains \"/api\" and rate(10m) > 100)"
    description = "Rate limit API endpoints"
    enabled = true
  }
}

# Rate Limiting Rules
resource "cloudflare_rate_limit" "api" {
  zone_id   = local.zone_id
  threshold = 60
  period    = 60
  match {
    request {
      url_pattern = "${var.domain_name}/api/*"
    }
  }
  action {
    mode    = "challenge"
    timeout = 60
  }
  description = "Rate limit API requests to 60/minute"
}

resource "cloudflare_rate_limit" "auth" {
  zone_id   = local.zone_id
  threshold = 5
  period    = 300
  match {
    request {
      url_pattern = "${var.domain_name}/auth/*"
    }
  }
  action {
    mode    = "block"
    timeout = 3600
  }
  description = "Rate limit authentication attempts"
}

# Load Balancer (for multi-region sync relay)
resource "cloudflare_load_balancer_pool" "sync_us" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  name       = "sync-us-pool"

  origins {
    name    = "sync-us-primary"
    address = "sync-us.${var.domain_name}"
    enabled = true
    weight  = 1
  }

  description = "US sync relay pool"
  enabled     = true

  check_regions = ["WNAM"]

  notification_email = var.alert_email
}

resource "cloudflare_load_balancer_pool" "sync_eu" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  name       = "sync-eu-pool"

  origins {
    name    = "sync-eu-primary"
    address = "sync-eu.${var.domain_name}"
    enabled = true
    weight  = 1
  }

  description = "EU sync relay pool"
  enabled     = true

  check_regions = ["WEU"]

  notification_email = var.alert_email
}

resource "cloudflare_load_balancer_pool" "sync_ap" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  name       = "sync-ap-pool"

  origins {
    name    = "sync-ap-primary"
    address = "sync-ap.${var.domain_name}"
    enabled = true
    weight  = 1
  }

  description = "AP sync relay pool"
  enabled     = true

  check_regions = ["SEAS"]

  notification_email = var.alert_email
}

# Health Check Monitor
resource "cloudflare_load_balancer_monitor" "sync" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  type       = "https"
  expected_codes = "200"
  method     = "GET"
  timeout    = 5
  path       = "/health"
  interval   = 60
  retries    = 2
  description = "Sync relay health check"

  header {
    header = "User-Agent"
    values = ["Graceful-Books-Health-Check"]
  }
}

# Geo-steering Load Balancer
resource "cloudflare_load_balancer" "sync" {
  zone_id          = local.zone_id
  name             = "sync.${var.domain_name}"
  fallback_pool_id = cloudflare_load_balancer_pool.sync_us.id
  default_pool_ids = [
    cloudflare_load_balancer_pool.sync_us.id,
    cloudflare_load_balancer_pool.sync_eu.id,
    cloudflare_load_balancer_pool.sync_ap.id
  ]
  description      = "Global sync relay load balancer with geo-steering"
  proxied          = true
  steering_policy  = "geo"

  session_affinity = "cookie"
  session_affinity_ttl = 3600

  pop_pools {
    pool_ids = [cloudflare_load_balancer_pool.sync_us.id]
    pop      = "LAX"
  }

  pop_pools {
    pool_ids = [cloudflare_load_balancer_pool.sync_eu.id]
    pop      = "LHR"
  }

  pop_pools {
    pool_ids = [cloudflare_load_balancer_pool.sync_ap.id]
    pop      = "SIN"
  }

  region_pools {
    region   = "WNAM"
    pool_ids = [cloudflare_load_balancer_pool.sync_us.id]
  }

  region_pools {
    region   = "WEU"
    pool_ids = [cloudflare_load_balancer_pool.sync_eu.id]
  }

  region_pools {
    region   = "SEAS"
    pool_ids = [cloudflare_load_balancer_pool.sync_ap.id]
  }
}

# Argo Smart Routing (requires Business or Enterprise plan)
resource "cloudflare_argo" "main" {
  count   = var.cloudflare_plan == "business" || var.cloudflare_plan == "enterprise" ? 1 : 0
  zone_id = local.zone_id
  tiered_caching = "on"
  smart_routing = "on"
}

# Notifications
resource "cloudflare_notification_policy" "ssl_expiration" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  name       = "SSL Certificate Expiration Alert"
  description = "Alert when SSL certificates are about to expire"
  enabled    = true
  alert_type = "universal_ssl_event_type"

  email_integration {
    id = var.alert_email
  }
}

resource "cloudflare_notification_policy" "zone_health" {
  account_id = data.cloudflare_accounts.main.accounts[0].id
  name       = "Zone Health Alert"
  description = "Alert on zone health issues"
  enabled    = true
  alert_type = "health_check_status_notification"

  email_integration {
    id = var.alert_email
  }
}

# Page Rules for redirects and caching
resource "cloudflare_page_rule" "www_redirect" {
  zone_id  = local.zone_id
  target   = "www.${var.domain_name}/*"
  priority = 1

  actions {
    forwarding_url {
      url         = "https://${var.domain_name}/$1"
      status_code = 301
    }
  }
}

resource "cloudflare_page_rule" "cache_static_assets" {
  zone_id  = local.zone_id
  target   = "${var.domain_name}/assets/*"
  priority = 2

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 2592000 # 30 days
    browser_cache_ttl = 1209600 # 14 days
  }
}

resource "cloudflare_page_rule" "no_cache_api" {
  zone_id  = local.zone_id
  target   = "${var.domain_name}/api/*"
  priority = 3

  actions {
    cache_level = "bypass"
  }
}
