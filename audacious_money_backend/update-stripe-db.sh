#!/bin/bash
# Update Stripe Product ID in Database
# This script reads JWT_SECRET from .env without exposing it

# Load .env file
set -a
source .env
set +a

# Make the API call
curl -X POST https://api.audacious.money/setup/stripe-product-id \
  -H "Content-Type: application/json" \
  -d "{
    \"secret\": \"$JWT_SECRET\",
    \"stripePriceId\": \"price_1TTGwPDAS9U3cd2IJj6TtyM7\",
    \"productSlug\": \"cpu-cpg-calculator\"
  }"

echo ""
