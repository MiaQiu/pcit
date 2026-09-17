#!/bin/bash
# Guard against new raw <TouchableOpacity> usage slipping back in without click tracking.
# New buttons should use <TrackedTouchable analyticsId="..."> (or <Button>, which wraps it).
#
# Usage: ./scripts/check-tracked-buttons.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Files allowed to reference raw TouchableOpacity:
#  - TrackedTouchable.tsx itself (the wrapper's own implementation)
#  - Screens that already hand-roll their own amplitudeService.trackEvent(...) calls
#    inline (flagged in codemod-report.md as "already-instrumented"; tracked, just not
#    via TrackedTouchable) - normalize these to TrackedTouchable when you next touch them.
ALLOWLIST=(
  "src/components/TrackedTouchable.tsx"
  "src/screens/ReportScreen.tsx"
  "src/screens/CoachChatScreen.tsx"
  "src/screens/ProfileScreen.tsx"
  "src/screens/ProfileReportScreen.tsx"
  "src/screens/ReportDetailScreen.tsx"
  "src/screens/DemoVideoDetailScreen.tsx"
  "src/screens/HomeScreen_v2.tsx"
)

matches=$(grep -rl "<TouchableOpacity" src --include="*.tsx" || true)

violations=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  allowed=false
  for a in "${ALLOWLIST[@]}"; do
    [ "$file" = "$a" ] && allowed=true && break
  done
  if [ "$allowed" = false ]; then
    violations="$violations$file\n"
  fi
done <<< "$matches"

if [ -n "$violations" ]; then
  echo "Found raw <TouchableOpacity> usage outside the allowlist — use <TrackedTouchable analyticsId=\"...\"> instead:"
  echo -e "$violations"
  exit 1
fi

echo "OK: no unauthorized raw <TouchableOpacity> usage found."
