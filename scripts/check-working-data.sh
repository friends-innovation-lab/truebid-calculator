#!/bin/bash
#
# Check for working_data writes outside the allowlist.
# This script enforces the Phase 1 working_data freeze.
#
# Usage: ./scripts/check-working-data.sh
# Exit code: 0 = pass, 1 = fail (unauthorized writes found)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ALLOWLIST="$SCRIPT_DIR/working-data-allowlist.txt"

if [ ! -f "$ALLOWLIST" ]; then
  echo "ERROR: Allowlist not found at $ALLOWLIST"
  exit 1
fi

# Find all files that write to working_data
# Patterns that indicate writes: working_data =, working_data:, .working_data, working_data.
WRITE_PATTERNS='working_data\s*[=:]|\.working_data\s*=|working_data\.'

# Get all TypeScript/TSX files with working_data writes
cd "$REPO_ROOT"
VIOLATIONS=""

while IFS= read -r file; do
  # Skip test files
  if [[ "$file" == *"__tests__"* ]] || [[ "$file" == *".test."* ]] || [[ "$file" == *".spec."* ]]; then
    continue
  fi

  # Skip if file is in allowlist
  RELATIVE_FILE="${file#./}"
  # Use fgrep for literal string matching (avoids regex issues with [])
  if grep -Fxq "$RELATIVE_FILE" "$ALLOWLIST" 2>/dev/null; then
    continue
  fi

  # Check if file actually writes to working_data (not just reads)
  if grep -qE "$WRITE_PATTERNS" "$file" 2>/dev/null; then
    # Exclude read-only patterns like "const x = working_data.foo" or type definitions
    # Focus on actual assignments
    if grep -E 'working_data\s*=' "$file" | grep -v 'const.*=.*working_data' | grep -v 'type.*working_data' | grep -qv '^\s*//' 2>/dev/null; then
      VIOLATIONS="$VIOLATIONS\n  $RELATIVE_FILE"
    fi
  fi
done < <(find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "./node_modules/*" -not -path "./.next/*")

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: working_data freeze violation detected!"
  echo ""
  echo "The following files write to working_data but are not in the allowlist:"
  echo -e "$VIOLATIONS"
  echo ""
  echo "Phase 1 Rule: No new writers to working_data may be introduced."
  echo "Use normalized tables + commands for new persistence."
  echo ""
  echo "If this is a legitimate legacy file, add it to:"
  echo "  $ALLOWLIST"
  exit 1
fi

echo "OK: No working_data freeze violations found."
exit 0
