#!/usr/bin/env bash
# Auto-runs after R2 bucket creation succeeds. Idempotent.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "── 1) Enable r2.dev public URL on bucket ──"
DEVURL=$(bunx wrangler r2 bucket dev-url enable loc-media 2>&1 | grep -oE 'https://pub-[a-z0-9]+\.r2\.dev' | head -1)
if [ -z "$DEVURL" ]; then
  echo "  ⚠ Could not auto-enable dev URL. Try via dashboard: R2 → loc-media → Settings → Public access → Allow Access."
  DEVURL="https://pub-PLACEHOLDER.r2.dev"
else
  echo "  ✓ Public dev URL: $DEVURL"
  # Update wrangler.toml
  sed -i.bak "s|R2_PUBLIC_BASE = \".*\"|R2_PUBLIC_BASE = \"$DEVURL\"|" wrangler.toml && rm wrangler.toml.bak
fi

echo
echo "── 2) Build dashboard ──"
bun run dashboard:build

echo
echo "── 3) Deploy ──"
bunx wrangler deploy 2>&1 | tail -20

echo
echo "── 4) Set PUBLIC_WORKER_URL secret to the deployed URL ──"
WORKER_URL=$(bunx wrangler deployments list 2>&1 | grep -oE 'https://[a-z0-9-]+\.workers\.dev' | head -1 || echo "https://loc-orchestrator.sungminna.workers.dev")
echo "  Worker URL: $WORKER_URL"

echo
echo "✓ Deployed. Now run scripts/bootstrap-ig.sh to seed Instagram account."
