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

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENTS_FILE="$REPO_ROOT/docs/ENVIRONMENTS.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Extract host from URL
# URL format: postgresql://user:pass@host:port/db or postgresql://user@host:port/db
HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')

if [[ -z "$HOST" ]]; then
    error "Could not extract host from database URL."
fi

echo ""
echo "=========================================="
echo "  REMOTE DATABASE MIGRATION"
echo "=========================================="
echo ""
echo "Target host: $HOST"
echo ""

# Check if ENVIRONMENTS.md exists
if [[ ! -f "$ENVIRONMENTS_FILE" ]]; then
    error "docs/ENVIRONMENTS.md not found. Cannot verify target."
fi

# Determine environment from host
ENV_NAME=""
PROJECT_REF=""

if echo "$HOST" | grep -q "qtotsijebcpddipmzstb"; then
    ENV_NAME="PRODUCTION"
    PROJECT_REF="qtotsijebcpddipmzstb"
elif echo "$HOST" | grep -q "tcobyquewjootwxpqijq"; then
    ENV_NAME="STAGING"
    PROJECT_REF="tcobyquewjootwxpqijq"
else
    error "Host '$HOST' does not match any known environment in docs/ENVIRONMENTS.md.

Known environments:
  - Production: qtotsijebcpddipmzstb
  - Staging: tcobyquewjootwxpqijq

Verify your --db-url is correct."
fi

# Verify the ref exists in ENVIRONMENTS.md
if ! grep -q "$PROJECT_REF" "$ENVIRONMENTS_FILE"; then
    error "Project ref '$PROJECT_REF' not found in docs/ENVIRONMENTS.md.

The environments file may be out of date, or the URL is incorrect."
fi

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
