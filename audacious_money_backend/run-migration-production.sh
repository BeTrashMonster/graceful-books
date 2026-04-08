#!/bin/bash
# Run database migrations in production
# This script is designed to run in Digital Ocean App Platform

echo "🚀 Running database migrations..."

# Run migrations
npm run migrate:up

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
    exit 0
else
    echo "❌ Migration failed"
    exit 1
fi
