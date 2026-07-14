#!/bin/bash
# db-push-remote.sh — Safe remote migration script
#
# This script is the ONLY authorized way to push migrations to staging or production.
# Direct use of `supabase db push` against remote databases is FORBIDDEN.
#
# Safety checks:
# 1. Requires explicit --db-url argument
# 2. Extracts and prints target host
# 3. Validates host against docs/ENVIRONMENTS.md refs table
# 4. Refuses if supabase/.temp/ exists (linked project)
# 5. Requires typing target ref to confirm
#
# Connection paths:
# - Direct: db.REF.supabase.co (extracts ref from hostname)
# - Pooler: aws-*.pooler.supabase.com (extracts ref from username: postgres.REF)
#
# IMPORTANT: Use session pooler (port 5432), NOT transaction pooler (port 6543).
# Migrations require session semantics for prepared statements and multi-statement DDL.
# The transaction pooler uses PgBouncer in transaction mode which breaks these operations.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENTS_FILE="$REPO_ROOT/docs/ENVIRONMENTS.md"

# Known environment refs (source of truth: docs/ENVIRONMENTS.md)
PROD_REF="qtotsijebcpddipmzstb"
STAGING_REF="tcobyquewjootwxpqijq"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

warn() {
    echo -e "${YELLOW}WARNING: $1${NC}" >&2
}

info() {
    echo -e "${GREEN}$1${NC}"
}

# Check for --db-url argument
DB_URL=""
for arg in "$@"; do
    if [[ "$arg" == --db-url=* ]]; then
        DB_URL="${arg#--db-url=}"
    fi
done

if [[ -z "$DB_URL" ]]; then
    error "Missing required --db-url argument.

Usage: $0 --db-url=\"postgresql://...\"

This script requires an explicit database URL. Direct linking is forbidden."
fi

# Check for linked project (FORBIDDEN)
if [[ -d "$REPO_ROOT/supabase/.temp" ]]; then
    error "supabase/.temp/ exists — a project is linked.

Remote operations with a linked project are FORBIDDEN.
Run: rm -rf supabase/.temp/

Then retry this script with explicit --db-url."
fi

# Extract host and username from URL
# URL format: postgresql://user:pass@host:port/db or postgresql://user@host:port/db
HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
USERNAME=$(echo "$DB_URL" | sed -E 's|.*://([^:@]+)[:@].*|\1|')

if [[ -z "$HOST" ]]; then
    error "Could not extract host from database URL."
fi

# Determine connection type and extract project ref
CONNECTION_TYPE=""
PROJECT_REF=""
ENV_NAME=""

# Check if this is a direct connection (db.REF.supabase.co)
if [[ "$HOST" =~ ^db\.([a-z0-9]+)\.supabase\.co$ ]]; then
    CONNECTION_TYPE="direct"
    PROJECT_REF="${BASH_REMATCH[1]}"

# Check if this is a pooler connection (aws-*.pooler.supabase.com)
elif [[ "$HOST" =~ ^aws-[0-9]+-[a-z]+-[a-z]+-[0-9]+\.pooler\.supabase\.com$ ]]; then
    CONNECTION_TYPE="pooler"

    # Extract ref from username (postgres.REF format)
    if [[ "$USERNAME" =~ ^postgres\.([a-z0-9]+)$ ]]; then
        PROJECT_REF="${BASH_REMATCH[1]}"
    else
        error "Pooler connection requires username in format 'postgres.REF'.

Got username: '$USERNAME'
Expected format: postgres.qtotsijebcpddipmzstb (or other known ref)

The project ref must be embedded in the username for pooler connections."
    fi

else
    error "Host '$HOST' is not a recognized Supabase connection.

Accepted connection types:
  - Direct: db.REF.supabase.co
  - Pooler: aws-N-REGION.pooler.supabase.com (with postgres.REF username)

Verify your --db-url is correct."
fi

# Validate project ref against known environments
if [[ "$PROJECT_REF" == "$PROD_REF" ]]; then
    ENV_NAME="PRODUCTION"
elif [[ "$PROJECT_REF" == "$STAGING_REF" ]]; then
    ENV_NAME="STAGING"
else
    error "Project ref '$PROJECT_REF' does not match any known environment.

Known environments:
  - Production: $PROD_REF
  - Staging: $STAGING_REF

If this is a new environment, add it to docs/ENVIRONMENTS.md first."
fi

# Check if ENVIRONMENTS.md exists
if [[ ! -f "$ENVIRONMENTS_FILE" ]]; then
    error "docs/ENVIRONMENTS.md not found. Cannot verify target."
fi

# Verify the ref exists in ENVIRONMENTS.md
if ! grep -q "$PROJECT_REF" "$ENVIRONMENTS_FILE"; then
    error "Project ref '$PROJECT_REF' not found in docs/ENVIRONMENTS.md.

The environments file may be out of date, or the URL is incorrect."
fi

# Print banner
echo ""
echo "=========================================="
echo "  REMOTE DATABASE MIGRATION"
echo "=========================================="
echo ""
echo "Target host: $HOST"
echo -e "Connection:  ${CYAN}$CONNECTION_TYPE${NC}"
echo ""
echo -e "${YELLOW}Environment: $ENV_NAME${NC}"
echo -e "${YELLOW}Project Ref: $PROJECT_REF${NC}"
echo ""

# Show what will be executed
echo "Command to execute:"
echo ""
echo "  supabase db push --db-url \"[REDACTED]\""
echo ""

# Show pending migrations
echo "Checking pending migrations..."
echo ""
cd "$REPO_ROOT"
supabase migration list --db-url "$DB_URL" 2>&1 | tail -20 || true
echo ""

# Confirmation prompt
echo "=========================================="
echo -e "${RED}  CONFIRMATION REQUIRED${NC}"
echo "=========================================="
echo ""
echo "You are about to push migrations to: $ENV_NAME"
echo ""
echo -e "${YELLOW}Type the project ref to confirm: $PROJECT_REF${NC}"
echo ""
read -r CONFIRM_REF

if [[ "$CONFIRM_REF" != "$PROJECT_REF" ]]; then
    error "Confirmation failed. You typed '$CONFIRM_REF' but expected '$PROJECT_REF'.

Migration aborted."
fi

# Execute the migration
echo ""
info "Confirmation accepted. Executing migration..."
echo ""

cd "$REPO_ROOT"
supabase db push --db-url "$DB_URL"

echo ""
info "Migration complete."
echo ""

# Post-migration verification
echo "Verifying migration status..."
supabase migration list --db-url "$DB_URL" 2>&1 | tail -10 || true
