#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/nora-mobile/.env.production"

echo "==> Switching .env.production to ap-southeast-1 (prod)"
sed -i '' \
  -e 's|^EXPO_PUBLIC_API_URL=https://p2tgddmyxt\.us-east-1\.awsapprunner\.com|#EXPO_PUBLIC_API_URL=https://p2tgddmyxt.us-east-1.awsapprunner.com|' \
  -e 's|^#EXPO_PUBLIC_API_URL=https://wpwpawhz29\.ap-southeast-1\.awsapprunner\.com|EXPO_PUBLIC_API_URL=https://wpwpawhz29.ap-southeast-1.awsapprunner.com|' \
  "$ENV_FILE"

echo "==> 1. Build nora-core"
cd "$SCRIPT_DIR/packages/nora-core" && npm run build

echo "==> 2. Prebuild mobile (prod)"
cd "$SCRIPT_DIR/nora-mobile" && NODE_ENV=production npx expo prebuild --platform ios

echo "==> 3. Install pods"
cd "$SCRIPT_DIR/nora-mobile/ios" && pod install

echo "==> 4. Deploy backend"
cd "$SCRIPT_DIR" && ./docker_deploy_prod.sh

echo "==> Prod deploy complete"
