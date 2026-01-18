#!/bin/bash
# Infrastructure Setup Script for Graceful Books
# Requirements: H10
#
# This script guides you through the initial infrastructure setup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Graceful Books Infrastructure Setup  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Terraform
if command -v terraform &> /dev/null; then
  echo -e "${GREEN}✓ Terraform installed$(terraform version | head -1)${NC}"
else
  echo -e "${RED}✗ Terraform not installed${NC}"
  echo "Install from: https://www.terraform.io/downloads"
  exit 1
fi

# Check Wrangler
if command -v wrangler &> /dev/null; then
  echo -e "${GREEN}✓ Wrangler installed ($(wrangler --version))${NC}"
else
  echo -e "${RED}✗ Wrangler not installed${NC}"
  echo "Install with: npm install -g wrangler"
  exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
  echo -e "${GREEN}✓ Node.js installed ($(node --version))${NC}"
else
  echo -e "${RED}✗ Node.js not installed${NC}"
  echo "Install from: https://nodejs.org"
  exit 1
fi

echo ""
echo -e "${GREEN}All prerequisites met!${NC}"
echo ""

# Step 1: Cloudflare Setup
echo -e "${BLUE}=== Step 1: Cloudflare Setup ===${NC}"
echo ""
echo "You'll need a Cloudflare account and API token."
echo ""
echo -e "${YELLOW}Instructions:${NC}"
echo "1. Go to https://dash.cloudflare.com"
echo "2. Sign up or log in"
echo "3. Go to My Profile > API Tokens"
echo "4. Create Token > Edit Cloudflare Workers (use template)"
echo "5. Add permissions: Workers, Pages, DNS, Zone Settings"
echo ""
read -p "Press Enter when you have your API token..."

read -p "Enter Cloudflare API Token: " -s CLOUDFLARE_API_TOKEN
echo ""
read -p "Enter Cloudflare Account ID: " CLOUDFLARE_ACCOUNT_ID
echo ""

export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID

echo -e "${GREEN}✓ Cloudflare credentials set${NC}"
echo ""

# Step 2: Turso Setup
echo -e "${BLUE}=== Step 2: Turso Database Setup ===${NC}"
echo ""
echo "You'll need a Turso account for the database."
echo ""
echo -e "${YELLOW}Instructions:${NC}"
echo "1. Go to https://turso.tech and sign up"
echo "2. Install Turso CLI:"
echo "   curl -sSfL https://get.tur.so/install.sh | bash"
echo "3. Run: turso auth login"
echo "4. Create database: turso db create graceful-books-sync --location iad"
echo "5. Get URL: turso db show graceful-books-sync --url"
echo "6. Create token: turso db tokens create graceful-books-sync"
echo ""
read -p "Press Enter when you have Turso credentials..."

read -p "Enter Turso Database URL: " TURSO_DATABASE_URL
echo ""
read -p "Enter Turso Auth Token: " -s TURSO_AUTH_TOKEN
echo ""

export TURSO_DATABASE_URL
export TURSO_AUTH_TOKEN

echo -e "${GREEN}✓ Turso credentials set${NC}"
echo ""

# Step 3: Create Terraform config
echo -e "${BLUE}=== Step 3: Configure Terraform ===${NC}"
echo ""

cd infrastructure

if [ ! -f terraform.tfvars ]; then
  echo "Creating terraform.tfvars from example..."
  cp terraform.tfvars.example terraform.tfvars

  read -p "Enter your Cloudflare account name: " ACCOUNT_NAME
  read -p "Enter your domain name (e.g., gracefulbooks.com): " DOMAIN_NAME
  read -p "Enter alert email address: " ALERT_EMAIL

  # Update terraform.tfvars
  sed -i "s/your-cloudflare-account-name/$ACCOUNT_NAME/" terraform.tfvars
  sed -i "s/gracefulbooks.com/$DOMAIN_NAME/" terraform.tfvars
  sed -i "s/alerts@gracefulbooks.com/$ALERT_EMAIL/" terraform.tfvars

  echo -e "${GREEN}✓ terraform.tfvars created${NC}"
else
  echo -e "${YELLOW}terraform.tfvars already exists, skipping...${NC}"
fi

echo ""

# Step 4: Initialize Terraform
echo -e "${BLUE}=== Step 4: Initialize Terraform ===${NC}"
echo ""

terraform init

echo -e "${GREEN}✓ Terraform initialized${NC}"
echo ""

# Step 5: Validate Terraform
echo -e "${BLUE}=== Step 5: Validate Configuration ===${NC}"
echo ""

terraform fmt
terraform validate

echo -e "${GREEN}✓ Configuration valid${NC}"
echo ""

# Step 6: Plan Infrastructure
echo -e "${BLUE}=== Step 6: Plan Infrastructure ===${NC}"
echo ""

echo "Generating Terraform plan..."
terraform plan -var-file=terraform.tfvars -out=tfplan

echo ""
echo -e "${YELLOW}Review the plan above. It shows what will be created.${NC}"
echo ""
read -p "Apply this plan? (yes/no): " -r

if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
  echo -e "${YELLOW}Setup cancelled. You can apply later with: terraform apply tfplan${NC}"
  exit 0
fi

# Step 7: Apply Infrastructure
echo -e "${BLUE}=== Step 7: Apply Infrastructure ===${NC}"
echo ""

terraform apply tfplan

echo -e "${GREEN}✓ Infrastructure created!${NC}"
echo ""

# Step 8: Save secrets
echo -e "${BLUE}=== Step 8: Save Secrets ===${NC}"
echo ""

echo "Saving secrets to GitHub..."

if command -v gh &> /dev/null; then
  echo "Setting GitHub secrets..."
  echo "$CLOUDFLARE_API_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN
  echo "$CLOUDFLARE_ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID
  echo "$TURSO_DATABASE_URL" | gh secret set TURSO_DATABASE_URL
  echo "$TURSO_AUTH_TOKEN" | gh secret set TURSO_AUTH_TOKEN

  echo -e "${GREEN}✓ GitHub secrets set${NC}"
else
  echo -e "${YELLOW}GitHub CLI not installed. Set secrets manually:${NC}"
  echo "  gh secret set CLOUDFLARE_API_TOKEN"
  echo "  gh secret set CLOUDFLARE_ACCOUNT_ID"
  echo "  gh secret set TURSO_DATABASE_URL"
  echo "  gh secret set TURSO_AUTH_TOKEN"
fi

echo ""
echo "Setting Cloudflare Worker secrets..."

cd ../relay

wrangler secret put TURSO_DATABASE_URL --env staging <<< "$TURSO_DATABASE_URL"
wrangler secret put TURSO_AUTH_TOKEN --env staging <<< "$TURSO_AUTH_TOKEN"

wrangler secret put TURSO_DATABASE_URL --env production <<< "$TURSO_DATABASE_URL"
wrangler secret put TURSO_AUTH_TOKEN --env production <<< "$TURSO_AUTH_TOKEN"

echo -e "${GREEN}✓ Worker secrets set${NC}"

cd ..

# Step 9: View outputs
echo ""
echo -e "${BLUE}=== Step 9: Infrastructure Summary ===${NC}"
echo ""

cd infrastructure
terraform output

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Infrastructure Setup Complete! 🎉   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Deploy Workers: cd relay && wrangler deploy --env staging"
echo "  2. Deploy Pages: git push origin main (automatic)"
echo "  3. Test staging: curl https://sync-staging.gracefulbooks.com/health"
echo "  4. Review docs: docs/INFRASTRUCTURE.md"
echo ""
echo -e "${BLUE}Happy deploying! 🚀${NC}"
