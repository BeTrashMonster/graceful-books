#!/bin/bash
# Run this script on your Digital Ocean app server
# It will update the Stripe product ID using the existing database connection

cd /app
bun run scripts/update-stripe-product-id.ts
