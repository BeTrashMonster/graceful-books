# Variables for Graceful Books Infrastructure
# Requirements: H10

# Cloudflare Configuration
variable "cloudflare_account_name" {
  description = "Cloudflare account name"
  type        = string
}

variable "cloudflare_plan" {
  description = "Cloudflare plan tier (free, pro, business, enterprise)"
  type        = string
  default     = "pro"

  validation {
    condition     = contains(["free", "pro", "business", "enterprise"], var.cloudflare_plan)
    error_message = "Plan must be one of: free, pro, business, enterprise"
  }
}

# Domain Configuration
variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
  default     = "gracefulbooks.com"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid domain format"
  }
}

variable "create_zone" {
  description = "Whether to create a new Cloudflare zone or use existing"
  type        = bool
  default     = false
}

# GitHub Integration
variable "github_org" {
  description = "GitHub organization or username"
  type        = string
  default     = "gracefulbooks"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "graceful-books"
}

# Environment Configuration
variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either staging or production"
  }
}

variable "node_version" {
  description = "Node.js version for builds"
  type        = string
  default     = "18"
}

# Alerting
variable "alert_email" {
  description = "Email address for infrastructure alerts"
  type        = string
}

# Feature Flags
variable "enable_argo" {
  description = "Enable Cloudflare Argo Smart Routing (requires Business+ plan)"
  type        = bool
  default     = false
}

variable "enable_load_balancer" {
  description = "Enable Cloudflare Load Balancer for geo-steering"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable Web Application Firewall rules"
  type        = bool
  default     = true
}

# Sync Relay Configuration
variable "sync_relay_regions" {
  description = "Regions for sync relay deployment"
  type        = list(string)
  default     = ["us", "eu", "ap"]
}

# R2 Storage Configuration
variable "r2_asset_bucket_name" {
  description = "Name for R2 assets bucket"
  type        = string
  default     = "graceful-books-assets"
}

variable "r2_backup_bucket_name" {
  description = "Name for R2 backups bucket"
  type        = string
  default     = "graceful-books-backups"
}

variable "r2_backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 90

  validation {
    condition     = var.r2_backup_retention_days >= 30
    error_message = "Backup retention must be at least 30 days"
  }
}

# Security Configuration
variable "trusted_ips" {
  description = "List of trusted IP addresses for admin access"
  type        = list(string)
  default     = []
}

variable "min_tls_version" {
  description = "Minimum TLS version"
  type        = string
  default     = "1.3"

  validation {
    condition     = contains(["1.2", "1.3"], var.min_tls_version)
    error_message = "TLS version must be 1.2 or 1.3"
  }
}

# Rate Limiting
variable "api_rate_limit_per_minute" {
  description = "API rate limit per minute"
  type        = number
  default     = 60
}

variable "auth_rate_limit_per_5min" {
  description = "Auth endpoint rate limit per 5 minutes"
  type        = number
  default     = 5
}

# Performance Configuration
variable "browser_cache_ttl" {
  description = "Browser cache TTL in seconds"
  type        = number
  default     = 14400 # 4 hours
}

variable "edge_cache_ttl" {
  description = "Edge cache TTL for static assets in seconds"
  type        = number
  default     = 2592000 # 30 days
}

# Tags
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Graceful Books"
    ManagedBy   = "Terraform"
    Environment = "production"
  }
}

# Worker Configuration
variable "worker_cpu_limit_ms" {
  description = "CPU time limit per Worker request in milliseconds"
  type        = number
  default     = 50
}

variable "worker_memory_limit_mb" {
  description = "Memory limit per Worker in MB"
  type        = number
  default     = 128
}
