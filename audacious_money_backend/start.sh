#!/bin/bash
# Production startup script
# Runs migrations before starting the server

set -e  # Exit on any error

echo "🔄 Running database migrations..."
npm run migrate:up

echo "🚀 Starting server..."
exec bun run src/index.ts
