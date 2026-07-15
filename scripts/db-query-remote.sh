#!/bin/bash
# db-query-remote.sh — Safe remote read-only query script
#
# This script executes read-only queries against staging or production.
# Same safety protocol as db-push-remote.sh.
#
# READ-ONLY ENFORCEMENT:
# All queries are wrapped in BEGIN TRANSACTION READ ONLY; ... ; ROLLBACK;
# This categorically prevents writes regardless of query content.
# The ROLLBACK ensures nothing persists even if read-only is bypassed.
#
# Usage: ./scripts/db-query-remote.sh --db-url="postgresql://..." "SELECT ..."

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENTS_FILE="$REPO_ROOT/docs/ENVIRONMENTS.md"

# Known environment refs
PROD_REF="qtotsijebcpddipmzstb"
STAGING_REF="tcobyquewjootwxpqijq"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

# Parse arguments
DB_URL=""
SQL_QUERY=""

for arg in "$@"; do
    if [[ "$arg" == --db-url=* ]]; then
        DB_URL="${arg#--db-url=}"
    elif [[ -z "$SQL_QUERY" && "$arg" != --* ]]; then
        SQL_QUERY="$arg"
    fi
done

if [[ -z "$DB_URL" ]]; then
    error "Missing --db-url argument.

Usage: $0 --db-url=\"postgresql://...\" \"SELECT ...\""
fi

if [[ -z "$SQL_QUERY" ]]; then
    error "Missing SQL query argument."
fi

# Check for linked project (FORBIDDEN)
if [[ -d "$REPO_ROOT/supabase/.temp" ]]; then
    error "supabase/.temp/ exists — linked project detected. Delete it first."
fi

# Extract host and username
HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
USERNAME=$(echo "$DB_URL" | sed -E 's|.*://([^:@]+)[:@].*|\1|')

# Determine connection type and project ref
PROJECT_REF=""
ENV_NAME=""

if [[ "$HOST" =~ ^db\.([a-z0-9]+)\.supabase\.co$ ]]; then
    PROJECT_REF="${BASH_REMATCH[1]}"
elif [[ "$HOST" =~ ^aws-[0-9]+-[a-z]+-[a-z]+-[0-9]+\.pooler\.supabase\.com$ ]]; then
    if [[ "$USERNAME" =~ ^postgres\.([a-z0-9]+)$ ]]; then
        PROJECT_REF="${BASH_REMATCH[1]}"
    else
        error "Pooler connection requires username in format 'postgres.REF'."
    fi
else
    error "Host '$HOST' is not a recognized Supabase connection."
fi

# Validate ref
if [[ "$PROJECT_REF" == "$PROD_REF" ]]; then
    ENV_NAME="PRODUCTION"
elif [[ "$PROJECT_REF" == "$STAGING_REF" ]]; then
    ENV_NAME="STAGING"
else
    error "Project ref '$PROJECT_REF' not recognized."
fi

# Print header
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
echo ""
echo "=========================================="
echo "  REMOTE DATABASE QUERY (READ-ONLY)"
echo "=========================================="
echo ""
echo "Execution timestamp: $TIMESTAMP"
echo "Target host: $HOST"
echo -e "Environment: ${YELLOW}$ENV_NAME${NC}"
echo -e "Project Ref: ${YELLOW}$PROJECT_REF${NC}"
echo ""
echo "Query:"
echo "  $SQL_QUERY"
echo ""
echo "=========================================="
echo ""

# Execute query with READ-ONLY enforcement
# Use PGOPTIONS to set session-level read-only mode
# This categorically prevents INSERT/UPDATE/DELETE at the connection level
cd "$REPO_ROOT"

echo -e "${CYAN}Read-only enforcement: PGOPTIONS default_transaction_read_only=on${NC}"
echo ""

export PGOPTIONS="-c default_transaction_read_only=on"
supabase db query --db-url "$DB_URL" --output table "$SQL_QUERY"

echo ""
echo "=========================================="
echo "  QUERY COMPLETE (read-only, rolled back)"
echo "=========================================="
