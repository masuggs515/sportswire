#!/usr/bin/env bash
# scripts/run_dev.sh
# Runs the SportsWire Flutter app against sportswire-dev (Supabase cloud project).
# Credentials are loaded from .env.dev (gitignored — never committed).
#
# Usage:
#   bash scripts/run_dev.sh                  # default device
#   bash scripts/run_dev.sh -d <device-id>   # specific device
#   bash scripts/run_dev.sh --release        # release mode

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.dev"

# Load .env.dev — tr -d '\r' strips Windows CRLF so values aren't poisoned with ^M
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | tr -d '\r' | xargs)
else
  echo "ERROR: $ENV_FILE not found."
  echo "Create .env.dev at the repo root and fill in:"
  echo "  SUPABASE_URL=           (Supabase dashboard → Project Settings → API → Project URL)"
  echo "  SUPABASE_PUBLISHABLE_KEY= (Supabase dashboard → Project Settings → API → anon/public key)"
  echo "  MIXPANEL_TOKEN=         (mixpanel.com → Project Settings → Project Token)"
  exit 1
fi

cd "$REPO_ROOT/sportswire"

flutter run \
  --dart-define=SUPABASE_URL="${SUPABASE_URL:-}" \
  --dart-define=SUPABASE_PUBLISHABLE_KEY="${SUPABASE_PUBLISHABLE_KEY:-}" \
  --dart-define=MIXPANEL_TOKEN="${MIXPANEL_TOKEN:-}" \
  "$@"
