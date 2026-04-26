#!/usr/bin/env bash
# Seed an Instagram Business account directly from a long-lived bootstrap token.
# Uses `wrangler d1 execute` + `wrangler kv key put` (logged-in OAuth) — no API token needed.
#
# Reads from .dev.vars: IG_BOOTSTRAP_TOKEN, LOC_MASTER_KEY, DEV_USER_EMAIL.
# Skips Threads (per current spec).

set -eu  # no pipefail — head -1 SIGPIPEs grep upstream
cd "$(dirname "$0")/.."

source .dev.vars
: "${IG_BOOTSTRAP_TOKEN:?missing IG_BOOTSTRAP_TOKEN}"
: "${LOC_MASTER_KEY:?missing LOC_MASTER_KEY}"
: "${DEV_USER_EMAIL:=sungmin@cleave.work}"

KV_TOKENS_ID="38fc7a0223fa43cfb453be07795a3f8a"

echo "── 1) Resolve user_id from D1 ──"
USER_ID=$(bunx wrangler d1 execute loc-app --remote --json \
  --command "SELECT id FROM users WHERE email='$DEV_USER_EMAIL' LIMIT 1" \
  2>/dev/null | bun -e 'const j=JSON.parse(await Bun.stdin.text());console.log(j[0]?.results?.[0]?.id??"")')

if [ -z "$USER_ID" ]; then
  echo "  ✗ No users row for $DEV_USER_EMAIL. Visit the deployed dashboard once to auto-provision."
  echo "  After dashboard hit, retry this script."
  exit 1
fi
echo "  ✓ user_id=$USER_ID"

echo
echo "── 2) Resolve IG Business User ID ──"
# Try graph.facebook.com (Page-linked Business)
PAGES=$(curl -s "https://graph.facebook.com/v25.0/me/accounts?fields=id,name,instagram_business_account&access_token=$IG_BOOTSTRAP_TOKEN")
IG_USER=$(echo "$PAGES" | grep -oE '"instagram_business_account":\{"id":"[0-9]+"' | head -1 | grep -oE '[0-9]+')

# Fallback: graph.instagram.com /me (Instagram Login flow)
if [ -z "$IG_USER" ]; then
  ME=$(curl -s "https://graph.instagram.com/v25.0/me?fields=id,username&access_token=$IG_BOOTSTRAP_TOKEN")
  IG_USER=$(echo "$ME" | grep -oE '"id":"[0-9]+"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$IG_USER" ]; then
  echo "  ✗ Could not resolve IG user id from token. Token may be invalid or wrong app type."
  echo "  graph.facebook.com response: $PAGES"
  exit 2
fi
echo "  ✓ ig_user_id=$IG_USER"

# Profile lookup
PROFILE=$(curl -s "https://graph.instagram.com/v25.0/$IG_USER?fields=username&access_token=$IG_BOOTSTRAP_TOKEN" \
  || curl -s "https://graph.facebook.com/v25.0/$IG_USER?fields=username&access_token=$IG_BOOTSTRAP_TOKEN")
HANDLE=$(echo "$PROFILE" | grep -oE '"username":"[^"]+"' | head -1 | cut -d'"' -f4)
echo "  ✓ handle=@$HANDLE"

echo
echo "── 3) Encrypt token (AES-GCM with LOC_MASTER_KEY) ──"
ACCOUNT_ID=$(bun -e 'console.log(require("@paralleldrive/cuid2").createId())')
KV_KEY="ig/$ACCOUNT_ID/access_token"
ENCRYPTED=$(bun -e "
const enc = new TextEncoder();
const masterKey = process.env.MK;
const plain = process.env.TOK;
const raw = await crypto.subtle.digest('SHA-256', enc.encode(masterKey));
const key = await crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['encrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const cipher = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, enc.encode(plain)));
const combined = new Uint8Array(iv.length + cipher.length);
combined.set(iv, 0); combined.set(cipher, iv.length);
let s=''; for (let i=0;i<combined.length;i++) s+=String.fromCharCode(combined[i]);
console.log(btoa(s));
" MK="$LOC_MASTER_KEY" TOK="$IG_BOOTSTRAP_TOKEN")
echo "  ✓ ciphertext ${#ENCRYPTED} bytes (KV key: $KV_KEY)"

echo
echo "── 4) PUT to KV TOKENS namespace ──"
echo -n "$ENCRYPTED" | bunx wrangler kv key put "$KV_KEY" --namespace-id "$KV_TOKENS_ID" --remote 2>&1 | tail -3

echo
echo "── 5) INSERT accounts row in D1 ──"
NOW=$(date +%s)000
EXPIRES=$((NOW + 60 * 24 * 3600 * 1000))
SQL="INSERT OR IGNORE INTO accounts (id, user_id, platform, handle, ig_user_id, token_kv_key, token_expires_at, refreshed_at, enabled, created_at, updated_at) VALUES ('$ACCOUNT_ID', '$USER_ID', 'instagram', '$HANDLE', '$IG_USER', '$KV_KEY', $EXPIRES, $NOW, 1, $NOW, $NOW)"
bunx wrangler d1 execute loc-app --remote --command "$SQL" 2>&1 | tail -5

echo
echo "✓ Bootstrap complete."
echo "  account_id=$ACCOUNT_ID  ig_user_id=$IG_USER  @$HANDLE"
echo "  Use this account_id when creating a topic with target instagram."
