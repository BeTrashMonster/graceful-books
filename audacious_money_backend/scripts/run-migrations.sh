#!/bin/bash
################################################################################
# Database Migration Runner for Digital Ocean PostgreSQL
#
# This script runs database migrations against a PostgreSQL database.
# It applies all migration files in the migrations directory in order.
#
# Usage:
#   ./scripts/run-migrations.sh
#
# Prerequisites:
#   - DATABASE_URL environment variable must be set
#   - psql command-line tool must be installed
#   - Migration files must exist in src/db/migrations/
#
# Environment Variables:
#   DATABASE_URL - PostgreSQL connection string
#     Format: postgresql://user:password@host:port/database?sslmode=require
#
# Exit codes:
#   0 - Migrations completed successfully
#   1 - Error occurred (missing DATABASE_URL, psql not found, migration failed)
#
# Examples:
#   # Run migrations
#   export DATABASE_URL="postgresql://doadmin:pass@host:25060/db?sslmode=require"
#   ./scripts/run-migrations.sh
#
#   # Run migrations with .env file
#   source .env.production && ./scripts/run-migrations.sh
################################################################################

set -e  # Exit immediately if any command fails
set -u  # Treat unset variables as an error
set -o pipefail  # Catch errors in pipelines

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emoji support (works on macOS/Linux, may not work on older Windows terminals)
ROCKET="🚀"
CHECK="✅"
CROSS="❌"
FOLDER="📁"
REFRESH="🔄"
MAGNIFY="🔍"
LIGHTBULB="💡"
WARNING="⚠️"

################################################################################
# Helper Functions
################################################################################

# Print success message
success() {
  echo -e "${GREEN}${CHECK} $1${NC}"
}

# Print error message
error() {
  echo -e "${RED}${CROSS} Error: $1${NC}" >&2
}

# Print info message
info() {
  echo -e "${CYAN}${ROCKET} $1${NC}"
}

# Print detail message
detail() {
  echo -e "${BLUE}${FOLDER} $1${NC}"
}

# Print warning message
warning() {
  echo -e "${YELLOW}${WARNING} Warning: $1${NC}"
}

################################################################################
# Validation
################################################################################

info "Database Migration Runner"
echo ""

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  error "DATABASE_URL environment variable not set"
  echo ""
  echo -e "${LIGHTBULB} ${YELLOW}Set it with:${NC}"
  echo "   export DATABASE_URL='postgresql://user:password@host:port/database?sslmode=require'"
  echo ""
  echo -e "${YELLOW}Or load from .env file:${NC}"
  echo "   source .env.production && ./scripts/run-migrations.sh"
  echo ""
  exit 1
fi

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  error "psql command not found"
  echo ""
  echo -e "${LIGHTBULB} ${YELLOW}Install PostgreSQL client:${NC}"
  echo "   macOS:    brew install postgresql"
  echo "   Ubuntu:   sudo apt-get install postgresql-client"
  echo "   Windows:  Download from https://www.postgresql.org/download/windows/"
  echo ""
  exit 1
fi

# Verify psql version
PSQL_VERSION=$(psql --version | grep -oP '\d+\.\d+' | head -1)
detail "Using psql version $PSQL_VERSION"

# Check if migrations directory exists
MIGRATIONS_DIR="src/db/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
  error "Migrations directory not found: $MIGRATIONS_DIR"
  echo ""
  echo -e "${LIGHTBULB} ${YELLOW}Expected directory structure:${NC}"
  echo "   audacious_money_backend/"
  echo "   └── src/"
  echo "       └── db/"
  echo "           └── migrations/"
  echo "               ├── 001_initial_schema.sql"
  echo "               └── ..."
  echo ""
  exit 1
fi

# Count migration files
MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -name "*.sql" -type f | wc -l)
if [ "$MIGRATION_COUNT" -eq 0 ]; then
  error "No migration files found in $MIGRATIONS_DIR"
  echo ""
  echo -e "${LIGHTBULB} ${YELLOW}Migration files should:${NC}"
  echo "   - Be in $MIGRATIONS_DIR/"
  echo "   - Have .sql extension"
  echo "   - Be named with numeric prefix (e.g., 001_initial_schema.sql)"
  echo ""
  exit 1
fi

detail "Found $MIGRATION_COUNT migration file(s) in $MIGRATIONS_DIR"
echo ""

################################################################################
# Database Connection Test
################################################################################

info "Testing database connection..."

# Test connection (timeout after 10 seconds)
if ! timeout 10 psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
  error "Cannot connect to database"
  echo ""
  echo -e "${LIGHTBULB} ${YELLOW}Troubleshooting:${NC}"
  echo "   1. Verify DATABASE_URL is correct"
  echo "   2. Check your IP is in Digital Ocean Trusted Sources"
  echo "   3. Ensure database is running"
  echo "   4. Verify network connectivity (ping the host)"
  echo ""
  exit 1
fi

success "Database connection successful"
echo ""

################################################################################
# Apply Migrations
################################################################################

info "Applying migrations..."
echo ""

# Track if any migrations failed
FAILED=0

# Process each migration file in order
for migration_file in $(find "$MIGRATIONS_DIR" -name "*.sql" -type f | sort); do
  # Extract filename from path
  FILENAME=$(basename "$migration_file")

  # Count lines in migration file
  LINE_COUNT=$(wc -l < "$migration_file")

  detail "Applying $FILENAME ($LINE_COUNT lines)..."

  # Run migration
  if psql "$DATABASE_URL" -f "$migration_file" > /dev/null 2>&1; then
    success "$FILENAME applied successfully"
  else
    # Migration failed - show detailed error
    error "Failed to apply $FILENAME"
    echo ""
    echo -e "${RED}Error details:${NC}"
    psql "$DATABASE_URL" -f "$migration_file" 2>&1 | sed 's/^/   /'
    echo ""
    FAILED=1
    break  # Stop on first failure
  fi
done

echo ""

# Check if migrations failed
if [ "$FAILED" -eq 1 ]; then
  error "Migration failed. Database may be in an inconsistent state."
  echo ""
  echo -e "${LIGHTBULB} ${YELLOW}Next steps:${NC}"
  echo "   1. Review the error message above"
  echo "   2. Fix the migration file or database state"
  echo "   3. Re-run this script"
  echo ""
  exit 1
fi

success "All migrations applied successfully"
echo ""

################################################################################
# Verification
################################################################################

info "Verifying database schema..."
echo ""

# Count tables
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')

if [ -z "$TABLE_COUNT" ] || [ "$TABLE_COUNT" -eq 0 ]; then
  warning "No tables found in database"
  echo ""
  echo -e "${LIGHTBULB} ${YELLOW}This may indicate:${NC}"
  echo "   - Migrations created tables in a different schema"
  echo "   - Migration files don't contain CREATE TABLE statements"
  echo "   - Database permissions issue"
  echo ""
else
  success "Found $TABLE_COUNT table(s) in database"
  echo ""

  # List all tables
  detail "Tables created:"
  psql "$DATABASE_URL" -c "\dt" 2>/dev/null | grep "public" | awk '{print "   - " $3}'
  echo ""
fi

# Verify schema_migrations table exists (if using migration tracking)
if psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations'" 2>/dev/null | grep -q 1; then
  success "Migration tracking table exists"

  # Count applied migrations
  APPLIED_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM schema_migrations" 2>/dev/null | tr -d ' ')
  detail "$APPLIED_COUNT migration(s) recorded in tracking table"
  echo ""
fi

################################################################################
# Summary
################################################################################

echo -e "${GREEN}================================================================${NC}"
success "Database setup complete!"
echo -e "${GREEN}================================================================${NC}"
echo ""

# Display connection info (without password)
echo -e "${CYAN}Connection Information:${NC}"
echo "$DATABASE_URL" | sed -E 's/(postgresql:\/\/[^:]+:)[^@]+(@.*)/\1***HIDDEN***\2/'
echo ""

echo -e "${CYAN}Next Steps:${NC}"
echo "   1. Verify database with: bun run scripts/verify-db-connection.ts"
echo "   2. Update .env.production with this DATABASE_URL"
echo "   3. Never commit .env.production to Git"
echo ""

exit 0
