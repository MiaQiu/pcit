#!/bin/bash
# Usage: ./admin-switch.sh [dev|prod]
# Switches the admin portal's API backend and redeploys to Vercel.

DEV_URL="https://p2tgddmyxt.us-east-1.awsapprunner.com"
PROD_URL="https://wpwpawhz29.ap-southeast-1.awsapprunner.com"

TARGET=${1:-}

if [[ "$TARGET" != "dev" && "$TARGET" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]"
  echo ""
  echo "  dev   → ${DEV_URL}"
  echo "  prod  → ${PROD_URL}"
  exit 1
fi

if [[ "$TARGET" == "dev" ]]; then
  BACKEND_URL="$DEV_URL"
else
  BACKEND_URL="$PROD_URL"
fi

VERCEL_JSON="admin/vercel.json"

cat > "$VERCEL_JSON" <<EOF
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "${BACKEND_URL}/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
EOF

echo "→ admin/vercel.json updated to ${TARGET} (${BACKEND_URL})"
echo "→ Deploying to Vercel..."

npx vercel --prod --scope qiuy0002-gmailcoms-projects --yes --archive=tgz

echo ""
echo "Done. Admin portal now points to ${TARGET} App Runner."
