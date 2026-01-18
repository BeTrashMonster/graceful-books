#!/bin/bash
# Blue-Green Deployment Script for Graceful Books
# Requirements: H10
#
# This script implements blue-green deployment strategy for Cloudflare Workers
# and Cloudflare Pages, enabling zero-downtime deployments with instant rollback

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-staging}"
COMPONENT="${2:-all}" # workers, pages, or all

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo -e "${RED}Error: Environment must be 'staging' or 'production'${NC}"
  exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Blue-Green Deployment - Graceful Books ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Component: ${COMPONENT}${NC}"
echo ""

# Function to check health endpoint
check_health() {
  local url=$1
  local max_attempts=10
  local attempt=1

  echo -e "${YELLOW}Checking health: $url${NC}"

  while [ $attempt -le $max_attempts ]; do
    if curl -sf "$url" > /dev/null; then
      echo -e "${GREEN}✓ Health check passed${NC}"
      return 0
    fi

    echo -e "${YELLOW}Attempt $attempt/$max_attempts failed, retrying in 3s...${NC}"
    sleep 3
    ((attempt++))
  done

  echo -e "${RED}✗ Health check failed after $max_attempts attempts${NC}"
  return 1
}

# Function to get current deployment version
get_current_version() {
  local service=$1
  wrangler deployments list --name "$service" --env "$ENVIRONMENT" | head -2 | tail -1 | awk '{print $1}'
}

# Function to deploy Workers with blue-green strategy
deploy_workers_blue_green() {
  echo -e "${BLUE}=== Deploying Cloudflare Workers (Blue-Green) ===${NC}"

  cd relay

  # Get current (blue) deployment version
  BLUE_VERSION=$(get_current_version "graceful-books-sync-relay")
  echo -e "${BLUE}Current (blue) version: ${BLUE_VERSION}${NC}"

  # Deploy new (green) version
  echo -e "${YELLOW}Deploying new (green) version...${NC}"
  wrangler deploy --env "$ENVIRONMENT"

  # Get new (green) deployment version
  GREEN_VERSION=$(get_current_version "graceful-books-sync-relay")
  echo -e "${GREEN}New (green) version deployed: ${GREEN_VERSION}${NC}"

  # Wait for deployment to propagate
  echo -e "${YELLOW}Waiting for deployment to propagate...${NC}"
  sleep 10

  # Health check on all regions
  echo -e "${YELLOW}Running health checks on all regions...${NC}"

  if [[ "$ENVIRONMENT" == "production" ]]; then
    REGIONS=("us" "eu" "ap" "")
  else
    REGIONS=("staging")
  fi

  for region in "${REGIONS[@]}"; do
    if [[ -z "$region" ]]; then
      SUBDOMAIN="sync"
    elif [[ "$region" == "staging" ]]; then
      SUBDOMAIN="sync-staging"
    else
      SUBDOMAIN="sync-$region"
    fi

    HEALTH_URL="https://${SUBDOMAIN}.gracefulbooks.com/health"

    if ! check_health "$HEALTH_URL"; then
      echo -e "${RED}✗ Health check failed for $SUBDOMAIN${NC}"
      echo -e "${RED}Deployment verification failed. Green deployment is unhealthy.${NC}"
      echo -e "${YELLOW}Rolling back to blue version: ${BLUE_VERSION}${NC}"

      # Rollback
      wrangler rollback --env "$ENVIRONMENT" --version-id "$BLUE_VERSION"

      echo -e "${RED}Rollback completed. Blue version restored.${NC}"
      exit 1
    fi
  done

  echo -e "${GREEN}✓ All health checks passed!${NC}"
  echo -e "${GREEN}✓ Green deployment is healthy and serving traffic${NC}"

  # Blue version is automatically replaced by Cloudflare Workers
  # No need for explicit traffic switching

  echo -e "${GREEN}Blue-Green deployment completed successfully!${NC}"
  echo -e "${BLUE}Green version (${GREEN_VERSION}) is now live${NC}"
  echo -e "${YELLOW}Blue version (${BLUE_VERSION}) can be used for rollback if needed${NC}"

  cd ..
}

# Function to deploy Pages with blue-green strategy
deploy_pages_blue_green() {
  echo -e "${BLUE}=== Deploying Cloudflare Pages (Blue-Green) ===${NC}"

  # Build application
  echo -e "${YELLOW}Building application...${NC}"
  npm ci
  npm run build

  # Get current deployment URL (blue)
  echo -e "${YELLOW}Fetching current deployment info...${NC}"

  # Deploy new version (green) to preview first
  echo -e "${YELLOW}Deploying green version to preview...${NC}"

  # Cloudflare Pages handles blue-green automatically
  # Preview deployments are green, production promotion is the switch

  PREVIEW_URL=$(npx wrangler pages deploy dist --project-name=graceful-books --branch=preview-$(date +%s) 2>&1 | grep -o 'https://[^[:space:]]*')

  echo -e "${GREEN}Preview (green) deployment: ${PREVIEW_URL}${NC}"

  # Health check on preview
  if ! check_health "$PREVIEW_URL"; then
    echo -e "${RED}✗ Preview deployment health check failed${NC}"
    echo -e "${RED}Green deployment is unhealthy. Aborting.${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Preview deployment is healthy${NC}"

  # Promote to production (switch blue to green)
  if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "${YELLOW}Promoting green deployment to production...${NC}"

    read -p "Promote to production? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
      echo -e "${YELLOW}Promotion cancelled. Green deployment remains in preview.${NC}"
      exit 0
    fi

    npx wrangler pages deploy dist --project-name=graceful-books --branch=main

    # Verify production
    sleep 10
    if check_health "https://gracefulbooks.com"; then
      echo -e "${GREEN}✓ Production deployment successful!${NC}"
      echo -e "${GREEN}Green version is now serving production traffic${NC}"
    else
      echo -e "${RED}✗ Production health check failed${NC}"
      echo -e "${RED}Manual rollback may be required${NC}"
      exit 1
    fi
  fi
}

# Function to rollback Workers
rollback_workers() {
  echo -e "${YELLOW}=== Rolling back Cloudflare Workers ===${NC}"

  cd relay

  # List recent deployments
  echo -e "${BLUE}Recent deployments:${NC}"
  wrangler deployments list --env "$ENVIRONMENT" | head -5

  echo ""
  read -p "Enter version ID to rollback to: " -r VERSION_ID

  if [[ -z "$VERSION_ID" ]]; then
    echo -e "${RED}No version ID provided. Aborting.${NC}"
    exit 1
  fi

  # Perform rollback
  echo -e "${YELLOW}Rolling back to version: ${VERSION_ID}${NC}"
  wrangler rollback --env "$ENVIRONMENT" --version-id "$VERSION_ID"

  # Verify rollback
  sleep 5
  HEALTH_URL="https://sync.gracefulbooks.com/health"

  if check_health "$HEALTH_URL"; then
    echo -e "${GREEN}✓ Rollback successful!${NC}"
  else
    echo -e "${RED}✗ Rollback verification failed${NC}"
    echo -e "${RED}Manual intervention required${NC}"
    exit 1
  fi

  cd ..
}

# Main execution
case "$COMPONENT" in
  workers)
    deploy_workers_blue_green
    ;;
  pages)
    deploy_pages_blue_green
    ;;
  all)
    deploy_workers_blue_green
    echo ""
    deploy_pages_blue_green
    ;;
  rollback-workers)
    rollback_workers
    ;;
  *)
    echo -e "${RED}Invalid component: $COMPONENT${NC}"
    echo "Usage: $0 <environment> <component>"
    echo "  environment: staging | production"
    echo "  component: workers | pages | all | rollback-workers"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Deployment Completed Successfully!    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
