#!/bin/bash
# Rollback Script for Graceful Books
# Requirements: H10
#
# This script provides emergency rollback procedures for all infrastructure components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
COMPONENT="${1:-}"
ENVIRONMENT="${2:-production}"

show_usage() {
  echo "Usage: $0 <component> [environment]"
  echo ""
  echo "Components:"
  echo "  workers    - Rollback Cloudflare Workers"
  echo "  pages      - Rollback Cloudflare Pages"
  echo "  database   - Restore database from backup"
  echo "  all        - Rollback all components (use with caution!)"
  echo ""
  echo "Environment: staging | production (default: production)"
  echo ""
  echo "Examples:"
  echo "  $0 workers production"
  echo "  $0 pages staging"
  echo "  $0 database production"
}

if [[ -z "$COMPONENT" ]]; then
  show_usage
  exit 1
fi

echo -e "${RED}╔════════════════════════════════════════╗${NC}"
echo -e "${RED}║     EMERGENCY ROLLBACK PROCEDURE       ║${NC}"
echo -e "${RED}╚════════════════════════════════════════╝${NC}"
echo -e "${YELLOW}Component: ${COMPONENT}${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo ""
echo -e "${RED}WARNING: This will rollback to a previous deployment.${NC}"
echo -e "${RED}Make sure you understand the implications!${NC}"
echo ""

read -p "Continue with rollback? (type 'ROLLBACK' to confirm): " -r
if [[ $REPLY != "ROLLBACK" ]]; then
  echo -e "${YELLOW}Rollback cancelled.${NC}"
  exit 0
fi

# Function to rollback Cloudflare Workers
rollback_workers() {
  echo -e "${BLUE}=== Rolling back Cloudflare Workers ===${NC}"

  cd relay

  # Show recent deployments
  echo -e "${BLUE}Recent deployments:${NC}"
  wrangler deployments list --env "$ENVIRONMENT" | head -10

  echo ""
  echo -e "${YELLOW}Select a version to rollback to.${NC}"
  echo -e "${YELLOW}Tip: The second row is usually the previous stable version${NC}"
  echo ""

  read -p "Enter version ID: " -r VERSION_ID

  if [[ -z "$VERSION_ID" ]]; then
    echo -e "${RED}No version ID provided. Aborting.${NC}"
    exit 1
  fi

  # Confirm version
  echo -e "${YELLOW}Rolling back to version: ${VERSION_ID}${NC}"
  read -p "Confirm rollback? (yes/no): " -r
  if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 0
  fi

  # Perform rollback
  echo -e "${YELLOW}Executing rollback...${NC}"
  wrangler rollback --env "$ENVIRONMENT" --version-id "$VERSION_ID"

  # Verify rollback
  echo -e "${YELLOW}Waiting for rollback to propagate...${NC}"
  sleep 10

  # Health checks
  if [[ "$ENVIRONMENT" == "production" ]]; then
    REGIONS=("us" "eu" "ap" "")
  else
    REGIONS=("staging")
  fi

  ALL_HEALTHY=true
  for region in "${REGIONS[@]}"; do
    if [[ -z "$region" ]]; then
      SUBDOMAIN="sync"
    elif [[ "$region" == "staging" ]]; then
      SUBDOMAIN="sync-staging"
    else
      SUBDOMAIN="sync-$region"
    fi

    HEALTH_URL="https://${SUBDOMAIN}.gracefulbooks.com/health"
    echo -e "${YELLOW}Checking $SUBDOMAIN...${NC}"

    if curl -sf "$HEALTH_URL" > /dev/null; then
      echo -e "${GREEN}✓ $SUBDOMAIN is healthy${NC}"
    else
      echo -e "${RED}✗ $SUBDOMAIN health check failed${NC}"
      ALL_HEALTHY=false
    fi
  done

  if $ALL_HEALTHY; then
    echo -e "${GREEN}✓ Rollback successful! All regions are healthy.${NC}"
  else
    echo -e "${RED}✗ Some regions failed health checks.${NC}"
    echo -e "${RED}Manual intervention may be required.${NC}"
    exit 1
  fi

  cd ..
}

# Function to rollback Cloudflare Pages
rollback_pages() {
  echo -e "${BLUE}=== Rolling back Cloudflare Pages ===${NC}"

  # List recent deployments
  echo -e "${BLUE}Recent deployments:${NC}"
  npx wrangler pages deployments list --project-name=graceful-books | head -10

  echo ""
  read -p "Enter deployment ID to rollback to: " -r DEPLOYMENT_ID

  if [[ -z "$DEPLOYMENT_ID" ]]; then
    echo -e "${RED}No deployment ID provided. Aborting.${NC}"
    exit 1
  fi

  # Confirm rollback
  echo -e "${YELLOW}Rolling back to deployment: ${DEPLOYMENT_ID}${NC}"
  read -p "Confirm rollback? (yes/no): " -r
  if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 0
  fi

  # Perform rollback by redeploying the old deployment
  echo -e "${YELLOW}Note: Cloudflare Pages doesn't support direct rollback.${NC}"
  echo -e "${YELLOW}You need to redeploy from the specific commit.${NC}"
  echo ""

  read -p "Enter git commit SHA to redeploy from: " -r COMMIT_SHA

  if [[ -z "$COMMIT_SHA" ]]; then
    echo -e "${RED}No commit SHA provided. Aborting.${NC}"
    exit 1
  fi

  # Checkout commit
  echo -e "${YELLOW}Checking out commit: ${COMMIT_SHA}${NC}"
  git checkout "$COMMIT_SHA"

  # Build and deploy
  echo -e "${YELLOW}Building application...${NC}"
  npm ci
  npm run build

  echo -e "${YELLOW}Deploying to Cloudflare Pages...${NC}"
  npx wrangler pages deploy dist --project-name=graceful-books --branch=main

  # Return to previous branch
  git checkout -

  # Verify
  echo -e "${YELLOW}Waiting for deployment to propagate...${NC}"
  sleep 15

  if curl -sf "https://gracefulbooks.com" > /dev/null; then
    echo -e "${GREEN}✓ Pages rollback successful!${NC}"
  else
    echo -e "${RED}✗ Health check failed after rollback${NC}"
    exit 1
  fi
}

# Function to restore database from backup
restore_database() {
  echo -e "${BLUE}=== Restoring Database from Backup ===${NC}"

  # List available backups
  echo -e "${BLUE}Available backups:${NC}"
  wrangler r2 object list graceful-books-db-backups --account-id="$CLOUDFLARE_ACCOUNT_ID" | head -20

  echo ""
  read -p "Enter backup filename to restore: " -r BACKUP_FILE

  if [[ -z "$BACKUP_FILE" ]]; then
    echo -e "${RED}No backup file provided. Aborting.${NC}"
    exit 1
  fi

  # Confirm restore
  echo -e "${RED}WARNING: This will replace current database data!${NC}"
  echo -e "${YELLOW}Restoring from: ${BACKUP_FILE}${NC}"
  read -p "Confirm restore? (type 'RESTORE' to confirm): " -r
  if [[ $REPLY != "RESTORE" ]]; then
    echo -e "${YELLOW}Restore cancelled.${NC}"
    exit 0
  fi

  # Download backup
  echo -e "${YELLOW}Downloading backup...${NC}"
  wrangler r2 object get graceful-books-db-backups/"$BACKUP_FILE" --file=/tmp/db-backup.sql

  # Restore to Turso
  echo -e "${YELLOW}Restoring to Turso database...${NC}"

  if [[ -z "${TURSO_DATABASE_URL}" || -z "${TURSO_AUTH_TOKEN}" ]]; then
    echo -e "${RED}TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set${NC}"
    exit 1
  fi

  # Execute restore (this is a simplified example - adjust based on actual backup format)
  turso db shell graceful-books-sync < /tmp/db-backup.sql

  # Cleanup
  rm /tmp/db-backup.sql

  echo -e "${GREEN}✓ Database restore completed${NC}"
  echo -e "${YELLOW}Verify data integrity before resuming normal operations${NC}"
}

# Function to rollback infrastructure (Terraform)
rollback_infrastructure() {
  echo -e "${BLUE}=== Rolling back Infrastructure ===${NC}"

  cd infrastructure

  echo -e "${YELLOW}This will revert infrastructure to a previous Terraform state.${NC}"
  echo ""

  # Show recent commits to infrastructure
  echo -e "${BLUE}Recent infrastructure changes:${NC}"
  git log --oneline --max-count=10 -- .

  echo ""
  read -p "Enter commit SHA to rollback to: " -r COMMIT_SHA

  if [[ -z "$COMMIT_SHA" ]]; then
    echo -e "${RED}No commit SHA provided. Aborting.${NC}"
    exit 1
  fi

  # Checkout infrastructure at that commit
  git checkout "$COMMIT_SHA" -- .

  # Plan the rollback
  echo -e "${YELLOW}Planning infrastructure rollback...${NC}"
  terraform init
  terraform plan -var-file="${ENVIRONMENT}.tfvars"

  echo ""
  read -p "Apply this plan? (yes/no): " -r
  if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    git checkout -- .
    exit 0
  fi

  # Apply rollback
  terraform apply -var-file="${ENVIRONMENT}.tfvars" -auto-approve

  echo -e "${GREEN}✓ Infrastructure rollback completed${NC}"

  cd ..
}

# Main rollback logic
case "$COMPONENT" in
  workers)
    rollback_workers
    ;;
  pages)
    rollback_pages
    ;;
  database)
    restore_database
    ;;
  infrastructure)
    rollback_infrastructure
    ;;
  all)
    echo -e "${RED}WARNING: Rolling back ALL components!${NC}"
    read -p "Are you absolutely sure? (type 'ROLLBACK ALL'): " -r
    if [[ $REPLY != "ROLLBACK ALL" ]]; then
      echo -e "${YELLOW}Rollback cancelled.${NC}"
      exit 0
    fi

    rollback_workers
    echo ""
    rollback_pages
    echo ""
    echo -e "${YELLOW}Database and infrastructure rollback skipped (manual only).${NC}"
    ;;
  *)
    echo -e "${RED}Invalid component: $COMPONENT${NC}"
    show_usage
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    Rollback Completed Successfully     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Post-rollback checklist:${NC}"
echo -e "  ${YELLOW}1.${NC} Verify all health checks are passing"
echo -e "  ${YELLOW}2.${NC} Check error logs for any issues"
echo -e "  ${YELLOW}3.${NC} Monitor application metrics"
echo -e "  ${YELLOW}4.${NC} Notify team of rollback"
echo -e "  ${YELLOW}5.${NC} Document root cause and prevention steps"
